import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./App.css";
import * as Y from "yjs";
import type { DeleteSet, StackItem } from "yjs/dist/src/internals";
import { WebsocketProvider } from "y-websocket";

type Struct = Y.Item | Y.GC | Y.Skip;

const MAP_KEY = "map";

const encodeHexString: (bytes: Uint8Array) => string = (bytes) => {
  return Array.from(bytes)
    .map((byte) => ("0" + byte.toString(16)).slice(-2))
    .join("");
};

const decodeHexString = (s: string): Uint8Array => {
  const bytes = new Uint8Array(s.length / 2);
  for (let i = 0; i < s.length; i += 2) {
    bytes[i / 2] = parseInt(s.slice(i, i + 2), 16);
  }
  return bytes;
};

const deleteSetToItems = (ds: DeleteSet) => {
  const items: { client: number; clock: number; len: number }[] = [];
  ds.clients.forEach((clientItems, client) => {
    for (const item of clientItems) {
      items.push({ client, clock: item.clock, len: item.len });
    }
  });
  return items;
};

const expandStruct = (struct: Struct): Struct[] => {
  if (!(struct instanceof Y.Item) || struct.length <= 1) {
    return [struct];
  }

  const content = struct.content.getContent();

  const structs: Struct[] = [];
  let origin = struct.origin;
  let parent = struct.parent;
  let parentSub = struct.parentSub;
  for (let i = 0; i < struct.length; i++) {
    const id = new Y.ID(struct.id.client, struct.id.clock + i);

    structs.push(
      new Y.Item(
        id,
        null,
        origin,
        null,
        null,
        parent,
        parentSub,
        new Y.ContentAny([content[i]])
      )
    );

    origin = id;
    parent = null;
    parentSub = null;
  }

  return structs;
};

const App = () => {
  const [[doc, wsProvider, undoManager]] = useState(() => {
    const doc = new Y.Doc();
    const wsProvider = new WebsocketProvider("", "test", doc, {
      connect: false,
    });
    const undoManager = new Y.UndoManager(doc.getMap(MAP_KEY), {
      ignoreRemoteMapChanges: true,
    });
    return [doc, wsProvider, undoManager] as const;
  });
  const [gc, setGc] = useState(false);
  useEffect(() => {
    doc.gc = gc;
  }, [doc, gc]);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (connected) {
      wsProvider.connectBc();
    } else {
      wsProvider.disconnectBc();
    }
  });
  const [ignoreRemoteMapChanges, setIgnoreRemoteMapChanges] = useState(true);
  useEffect(() => {
    undoManager.ignoreRemoteMapChanges = ignoreRemoteMapChanges;
  }, [undoManager, ignoreRemoteMapChanges]);
  const [showUpdates, setShowUpdates] = useState(false);
  const [showUndoStack, setShowUndoStack] = useState(false);

  const [serializedDoc, setSerializedDoc] = useState<string>("");

  const [docStructs, setDocStructs] = useState<Struct[]>([]);
  const [docDeleteSet, setDocDeleteSet] = useState<DeleteSet | null>(null);
  const [docDeleteSetItems, setDocDeleteSetItems] = useState<
    { client: number; clock: number; len: number }[]
  >([]);
  const [docStateVectorItems, setDocStateVectorItems] = useState<
    { client: number; clock: number }[]
  >([]);

  const [updates, setUpdates] = useState<
    { structs: Struct[]; ds: DeleteSet; encoded: Uint8Array }[]
  >([]);

  const handleUpdate = useCallback(
    (update: Uint8Array, origin: any, doc: Y.Doc, tr: Y.Transaction) => {
      const { structs, ds } = Y.decodeUpdate(update);
      setUpdates((updates) => [...updates, { structs, ds, encoded: update }]);

      const { structs: docStructs, ds: docDeleteSet } = Y.decodeUpdate(
        Y.encodeStateAsUpdate(doc)
      );
      setDocStructs(docStructs.flatMap(expandStruct));
      setDocDeleteSet(docDeleteSet);
      setDocDeleteSetItems(deleteSetToItems(docDeleteSet));

      const stateVectorItems: { client: number; clock: number }[] = [];
      Y.decodeStateVector(Y.encodeStateVector(doc)).forEach((clock, client) => {
        stateVectorItems.push({ client, clock });
      });
      setDocStateVectorItems(stateVectorItems);

      setSerializedDoc(
        JSON.stringify(doc.getMap(MAP_KEY).toJSON(), undefined, 2)
      );
    },
    []
  );

  useEffect(() => {
    doc.on("update", handleUpdate);
    return () => {
      doc.off("update", handleUpdate);
    };
  }, [doc, handleUpdate]);

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleClick = useCallback(() => {
    const code = textAreaRef.current?.value;
    if (code == null) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    doc;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    decodeHexString;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const YMap = Y.Map;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const YArray = Y.Array;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const applyUpdate = (s: string) => {
      Y.applyUpdate(doc, decodeHexString(s));
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mergeUpdates = (strs: string[]) => {
      return encodeHexString(Y.mergeUpdates(strs.map(decodeHexString)));
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const map = doc.getMap(MAP_KEY);
    try {
      // eslint-disable-next-line no-eval
      eval(code);
    } catch (e) {
      alert(e);
    }
  }, [doc]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          marginLeft: "16px",
          marginTop: "16px",
          gap: "16px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            border: "1px solid #000",
            borderRadius: "4px",
            padding: "4px",
            backgroundColor: clientColor(doc.clientID),
          }}
        >
          Client ID: {doc.clientID}
        </div>
        <div>
          <input
            type="checkbox"
            checked={gc}
            onChange={(e) => {
              setGc(e.target.checked);
            }}
          />{" "}
          GC
        </div>
        <div>
          <input
            type="checkbox"
            checked={connected}
            onChange={(e) => {
              setConnected(e.target.checked);
            }}
          />{" "}
          Connected
        </div>
        <div>
          <input
            type="checkbox"
            checked={showUpdates}
            onChange={(e) => {
              setShowUpdates(e.target.checked);
            }}
          />{" "}
          Updates
        </div>
        <div>
          <input
            type="checkbox"
            checked={showUndoStack}
            onChange={(e) => {
              setShowUndoStack(e.target.checked);
            }}
          />{" "}
          Undo stack
        </div>
        <div>
          <input
            type="checkbox"
            checked={!ignoreRemoteMapChanges}
            onChange={(e) => {
              setIgnoreRemoteMapChanges(!e.target.checked);
            }}
          />{" "}
          Broken undo
        </div>
        <div>
          <button
            onClick={() => {
              undoManager.undo();
            }}
            disabled={!undoManager.canUndo()}
          >
            Undo
          </button>
        </div>
        <div>
          <button
            onClick={() => {
              undoManager.redo();
            }}
            disabled={!undoManager.canRedo()}
          >
            Redo
          </button>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          margin: "16px",
          gap: "16px",
        }}
      >
        <textarea
          ref={textAreaRef}
          spellCheck={false}
          style={{
            flex: 1,
            height: "80px",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) {
              handleClick();
            }
          }}
        />
        <button onClick={handleClick}>Run</button>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flex: 1,
          gap: "16px",
          marginLeft: "16px",
          marginRight: "16px",
        }}
      >
        <div
          style={{
            flex: 4,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <AppSection title="Structs">
            <YjsStructs
              structs={docStructs}
              deleteSet={docDeleteSet}
              stateVectorItems={docStateVectorItems}
            />
          </AppSection>
          {showUpdates ? (
            <AppSection title="Updates">
              <YjsUpdates updates={updates} />
            </AppSection>
          ) : null}
          {showUndoStack ? (
            <AppSection title="Undo stack">
              <YjsUndoStackItems stackItems={undoManager.undoStack} />
            </AppSection>
          ) : null}
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflowX: "hidden",
            gap: "16px",
          }}
        >
          <div>
            <AppSection title="JSON">
              <pre>{serializedDoc}</pre>
            </AppSection>
          </div>
          <div>
            <AppSection title="Delete set">
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                {docDeleteSetItems.map(({ client, clock, len }) => (
                  <YjsDeleteItem client={client} clock={clock} len={len} />
                ))}
              </div>
            </AppSection>
          </div>
          <div>
            <AppSection title="State vector">
              {docStateVectorItems.map(({ client, clock }) => (
                <YjsStateVectorItem client={client} clock={clock} />
              ))}
            </AppSection>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppSection = ({ title, children }: { title: string; children: any }) => {
  return (
    <div
      style={{
        border: "1px solid #000",
        borderRadius: "16px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        overflowX: "scroll",
      }}
    >
      <div style={{ fontSize: "16px", fontWeight: "bold" }}>{title}</div>
      {children}
    </div>
  );
};

const yjsIdToKey = (id: Y.ID) => `${id.client},${id.clock}`;

const YjsStructs = ({
  structs,
  deleteSet,
  stateVectorItems,
  groupStructs = true,
}: {
  structs: Struct[];
  deleteSet: DeleteSet | null;
  stateVectorItems?: { client: number; clock: number }[];
  groupStructs?: boolean;
}) => {
  const chains = useMemo(() => {
    if (!groupStructs) {
      return [structs];
    }

    // First, get a full picture of all potential IDs we might run into.
    const keyToRootKey: { [k: string]: string } = {};
    for (const struct of structs) {
      for (let i = 0; i < struct.length; i++) {
        keyToRootKey[
          yjsIdToKey(new Y.ID(struct.id.client, struct.id.clock + i))
        ] = yjsIdToKey(struct.id);
      }
    }

    // Identify connected components in structs, and topologically sort them.
    const originToChildren: { [k: string]: string[] } = {};
    const keyToStruct: { [k: string]: Struct } = {};
    for (const struct of structs) {
      if (struct instanceof Y.Item) {
        const key = yjsIdToKey(struct.id);
        keyToStruct[key] = struct;
        if (struct.origin !== null) {
          const originKey = keyToRootKey[yjsIdToKey(struct.origin)];
          originToChildren[originKey] = [
            ...(originToChildren[originKey] ?? []),
            key,
          ];
        }
        if (struct.rightOrigin !== null) {
          const rightOriginKey = keyToRootKey[yjsIdToKey(struct.rightOrigin)];
          originToChildren[rightOriginKey] = [
            ...(originToChildren[rightOriginKey] ?? []),
            key,
          ];
        }
      }
    }

    const recurse = (key: string) => {
      const children = originToChildren[key] ?? [];
      const results: Struct[] = [keyToStruct[key]];
      for (const childKey of children) {
        results.push(...recurse(childKey));
      }
      return results;
    };

    const chains: Struct[][] = [];

    for (const struct of structs) {
      const key = yjsIdToKey(struct.id);
      if (
        !(struct instanceof Y.Item) ||
        (struct.origin === null && struct.rightOrigin === null)
      ) {
        const results = recurse(key);
        /*
        const deleted = results.filter(
          (struct) => deleteSet !== null && Y.isDeleted(deleteSet, struct.id)
        );
        const nonDeleted = results.filter(
          (struct) => deleteSet === null || !Y.isDeleted(deleteSet, struct.id)
        );
        */
        chains.push(results);
      }
    }

    return chains;
  }, [groupStructs, structs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {chains.map((structs, i) => (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "2px",
            flexWrap: "wrap",
          }}
          key={`${i}`}
        >
          {structs.map((struct) =>
            struct != null ? (
              <YjsStruct
                struct={struct}
                deleteSet={deleteSet}
                stateVectorItems={stateVectorItems}
              />
            ) : null
          )}
        </div>
      ))}
    </div>
  );
};

const COLORS = [
  "#f8d8f2",
  "#eccce0",
  "#d3cce4",
  "#e4dcff",
  "#ccdaf8",
  "#ccf0f4",
  "#cce1e0",
  "#e8f0d2",
  "#fff0cc",
  "#ecdccc",
  "#ffe2cc",
  "#fadad6",
];

const clientColor = (client: number) => COLORS[client % COLORS.length];

const OriginPill = ({ id }: { id: Y.ID }) => (
  <div
    style={{
      display: "inline-block",
      border: "1px solid #000",
      borderRadius: "4px",
      padding: "4px",
      fontSize: "12px",
      backgroundColor: clientColor(id.client),
    }}
  >
    Clock: {id.clock}
  </div>
);

const YjsStruct = ({
  struct,
  deleteSet,
  stateVectorItems,
}: {
  struct: Struct;
  deleteSet: DeleteSet | null;
  stateVectorItems?: { client: number; clock: number }[];
}) => {
  const isDeleted =
    deleteSet !== null ? Y.isDeleted(deleteSet, struct.id) : false;

  const stateVectorLatestClock = stateVectorItems?.find(
    ({ client }) => client === struct.id.client
  )?.clock;
  const isMissingFromStateVector =
    stateVectorItems !== undefined &&
    (stateVectorLatestClock === undefined ||
      struct.id.clock > stateVectorLatestClock);

  return (
    <div
      style={{
        backgroundColor: clientColor(struct.id.client),
        border: "1px solid #000",
        borderRadius: 16,
        padding: 16,
        opacity: isDeleted ? 0.5 : 1,
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: "bold" }}>
        Client {struct.id.client}
      </div>
      <div>
        Clock:{" "}
        {struct.length > 1
          ? `${struct.id.clock} → ${struct.id.clock + struct.length - 1}`
          : `${struct.id.clock}`}
        {isMissingFromStateVector ? " ‼️" : null}
      </div>
      {struct instanceof Y.GC ? <div>GC</div> : null}
      {struct instanceof Y.Skip ? <div>Skip</div> : null}
      {struct instanceof Y.Item ? (
        <>
          {struct.parent != null ? (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              Parent:&nbsp;
              {struct.parent instanceof Y.ID ? (
                <OriginPill id={struct.parent} />
              ) : (
                JSON.stringify(struct.parent)
              )}
            </div>
          ) : null}
          {struct.parentSub != null ? <div>Key: {struct.parentSub}</div> : null}
          {struct.origin != null ? (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              Origin:&nbsp;
              <OriginPill id={struct.origin} />
            </div>
          ) : null}
          {struct.rightOrigin != null ? (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              Right origin:&nbsp;
              <OriginPill id={struct.rightOrigin} />
            </div>
          ) : null}
          {struct.content.getContent().length > 0 ? (
            <div>Content: {JSON.stringify(struct.content.getContent())}</div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

const YjsDeleteItem = ({
  client,
  clock,
  len,
}: {
  client: number;
  clock: number;
  len: number;
}) => {
  return (
    <div
      style={{
        backgroundColor: clientColor(client),
        border: "1px solid #000",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: "bold" }}>
        Client {client}
      </div>
      <div>Clock: {len > 1 ? `${clock} → ${clock + len - 1}` : `${clock}`}</div>
    </div>
  );
};

const YjsStateVectorItem = ({
  client,
  clock,
}: {
  client: number;
  clock: number;
}) => {
  return (
    <div
      style={{
        backgroundColor: clientColor(client),
        border: "1px solid #000",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: "bold" }}>
        Client {client}
      </div>
      <div>Clock: {clock}</div>
    </div>
  );
};

const YjsUpdates = ({
  updates,
}: {
  updates: { structs: Struct[]; ds: DeleteSet; encoded: Uint8Array }[];
}) => {
  const [_idx, setIdx] = useState(0);
  const [latest, setLatest] = useState(false);
  const idx = latest ? updates.length - 1 : _idx;
  const currentUpdate = updates[idx];

  const encodedHex = useMemo(() => {
    if (currentUpdate === undefined) {
      return "";
    }
    return encodeHexString(currentUpdate.encoded);
  }, [currentUpdate]);

  const dsItems = useMemo(() => {
    if (currentUpdate === undefined) {
      return [];
    }
    return deleteSetToItems(currentUpdate.ds);
  }, [currentUpdate]);

  if (updates.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        overflowX: "scroll",
      }}
    >
      <div style={{ display: "flex", flexDirection: "row", gap: "8px" }}>
        <div>
          {idx + 1} of {updates.length}
        </div>
        <button
          onClick={() => {
            setIdx((idx) => (idx > 0 ? idx - 1 : idx));
          }}
        >
          Prev
        </button>
        <button
          onClick={() => {
            setIdx((idx) => (idx < updates.length - 1 ? idx + 1 : idx));
          }}
        >
          Next
        </button>
        <div>
          <input
            type="checkbox"
            checked={latest}
            onChange={(e) => {
              setLatest(e.target.checked);
            }}
          />{" "}
          Latest
        </div>
      </div>
      {currentUpdate !== undefined ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "row", gap: "16px" }}>
            <AppSection title="Structs">
              <YjsStructs
                structs={currentUpdate.structs}
                deleteSet={null}
                groupStructs={false}
              />
            </AppSection>
            <AppSection title="Delete set">
              {dsItems.map(({ client, clock, len }) => (
                <YjsDeleteItem client={client} clock={clock} len={len} />
              ))}
            </AppSection>
          </div>
          <div>
            <pre style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
              {encodedHex}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const YjsUndoStackItem = ({ stackItem }: { stackItem: StackItem }) => {
  return (
    <div
      style={{
        border: "1px solid #000",
        borderRadius: "16px",
        padding: "16px",
        display: "flex",
        flexDirection: "row",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          flex: 1,
        }}
      >
        <div>Insertions</div>
        <div style={{ display: "flex", flexDirection: "row", gap: "4px" }}>
          {deleteSetToItems(stackItem.insertions).map(
            ({ client, clock, len }, i) => (
              <YjsDeleteItem
                key={`${i}`}
                client={client}
                clock={clock}
                len={len}
              />
            )
          )}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          flex: 1,
        }}
      >
        <div>Deletions</div>
        <div style={{ display: "flex", flexDirection: "row", gap: "4px" }}>
          {deleteSetToItems(stackItem.deletions).map(
            ({ client, clock, len }, i) => (
              <YjsDeleteItem
                key={`${i}`}
                client={client}
                clock={clock}
                len={len}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};

const YjsUndoStackItems = ({ stackItems }: { stackItems: StackItem[] }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {[...stackItems].reverse().map((item, i) => (
        <YjsUndoStackItem key={`${i}`} stackItem={item} />
      ))}
    </div>
  );
};

export default App;
