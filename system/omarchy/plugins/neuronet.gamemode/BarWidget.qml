import QtQuick
import Quickshell
import Quickshell.Io
import qs.Ui
import qs.Commons

// NeuroNet Game Mode -- the controller in the top bar.
//
// Click: game mode on -- NeuroNet, its widgets, services and shortcuts stop
// to free memory for games. Click again: they all come back. The work is done
// by gamemode.py beside this file (see there); this only shows the state,
// read from the state file the script keeps, and asks for the switch.
BarWidget {
  id: root
  moduleName: "neuronet.gamemode"

  readonly property string script: Qt.resolvedUrl("gamemode.py").toString().replace("file://", "")
  readonly property string statePath: Quickshell.env("HOME") + "/.local/state/omarchy/neuronet-gamemode.json"
  readonly property bool light: Color.background.hslLightness > 0.5
  readonly property color signal: light ? "#007c8c" : "#00E5FF"

  property bool on: false
  property bool busy: false

  FileView {
    id: stateFile
    path: root.statePath
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      try { root.on = !!JSON.parse(text()).on } catch (e) { root.on = false }
      root.busy = false
    }
    onLoadFailed: { root.on = false; root.busy = false }
  }
  // the switch can take a few seconds (NeuroNet is given time to stop)
  Timer { id: unstick; interval: 15000; onTriggered: root.busy = false }

  function toggle() {
    if (busy) return
    busy = true
    unstick.restart()
    Quickshell.execDetached(["python3", root.script, "toggle"])
  }

  // after a reboot in game mode, put everything back
  Component.onCompleted: Quickshell.execDetached(["python3", root.script, "boot-check"])

  implicitWidth: glyph.implicitWidth + Style.space(14)
  implicitHeight: barSize

  Text {
    id: glyph
    anchors.centerIn: parent
    textFormat: Text.PlainText
    text: "󰊴"
    color: root.on ? root.signal : Qt.darker(root.bar.barForeground, 1.15)
    font.family: root.bar.fontFamily
    font.pixelSize: Style.font.body + 2
    opacity: root.busy ? 0.35 : 1
    SequentialAnimation on opacity {
      running: root.busy
      loops: Animation.Infinite
      NumberAnimation { to: 1; duration: 450 }
      NumberAnimation { to: 0.35; duration: 450 }
    }
  }

  MouseArea {
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onClicked: root.toggle()
    onEntered: if (root.bar) root.bar.showTooltip(root, root.busy ? "Game mode: switching…"
      : root.on ? "Game mode on — NeuroNet paused. Click to bring it back."
      : "Game mode — click to pause NeuroNet and free memory for games")
    onExited: if (root.bar) root.bar.hideTooltip(root)
  }
}
