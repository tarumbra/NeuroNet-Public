import QtQuick
import Quickshell
import Quickshell.Io

// Where NeuroNet is on this computer -- for the desktop widgets.
//
// NeuroNet System plan, Stage 1 (2026-09-29): no widget names a folder any
// more. They ask this, which reads ~/.config/neuronet/paths.json (written by
// neuronet-setup; the same file `neuronet-path` reads):
//     { "app": "/home/you/NeuroNet", "data": "..." }   -> app, dataDir
// "data" may be missing: then it's the app's own neuronet_data folder.
//
// Read synchronously (blockLoading), so a widget has its paths as soon as it's
// made; and watched, so moving NeuroNet (neuronet-setup again) follows
// through without a restart.
//
// THE SAME FILE is in every neuronet.* plugin that needs it; the original is
// system/qml/NeuroNetPaths.qml in the NeuroNet repo. Keep them identical --
// test/test_portable.py says if they drift.
Item {
  id: nn
  visible: false
  width: 0; height: 0

  property var conf: ({})
  readonly property string app: String(conf.app || "")
  readonly property string dataDir: String(conf.data || (app ? app + "/neuronet_data" : ""))
  readonly property bool ready: app !== ""

  // Read when loaded, and again when the file changes -- not from inside a
  // binding, where the read itself would set the binding off again.
  function read() {
    try { conf = JSON.parse(file.text() || "{}") } catch (e) { conf = ({}) }
  }
  Component.onCompleted: read()

  FileView {
    id: file
    path: Quickshell.env("HOME") + "/.config/neuronet/paths.json"
    blockLoading: true
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: nn.read()
  }
}
