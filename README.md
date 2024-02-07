# Getting started with Yjs sandbox

In the project directory, you can run:

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

---

The app visualises changes to a `Y.Map` object named `map`.

You can manipulate it by typing a JS expression into the text box and clicking "Run", or pressing Cmd+Enter.
e.g.
```
map.set("x", 0);
```
or for testing transactions:
```
doc.transact(() => {
  map.set("x", 10);
  map.set("y", 20);
});
```

For applying a hex-encoded update to the doc:
```
applyUpdate("010188e3b4b40c002801036d6170036d7367017706486f7764792100");
```

The state of the Yjs doc's internals will be rendered under "Structs" and "Delete set" (structs included in the delete set will appear faded out).

Checkboxes at the top:
 - "Connected" enables cross-tab communication, so if you open the app in multiple tabs, you can test out how Yjs behaves with multiple clients communicating with each other
 - "GC" turns on garbage collection for the doc
 - "Updates" shows the list of updates applied to the doc, including their binary representation, hex-encoded (you can apply these with `applyUpdate`)
 - "Undo stack" shows the state of the undo stack
 - "Broken undo" turns off the undo manager's `ignoreRemoteMapChanges` flag
