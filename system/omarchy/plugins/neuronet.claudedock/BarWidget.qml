import QtQuick
import Quickshell
import Quickshell.Io
import qs.Ui
import qs.Commons

// Claude dock: Claude Code chats tucked into the top bar (rebuilt on the laptop, 10 Nov 2026).
// Super+Alt+U or a left click: tuck the chat you're in, or bring one back (one that has replied first).
// Right click: bring them all back. The star flashes while a tucked chat has replied.
// claudedock.py does the moving and writes the state file; this only watches that file (no polling, no timers;
// the flash runs only while there's a reply waiting).
BarWidget {
  id: root
  moduleName: "neuronet.claudedock"

  property var tucked: []
  property var replied: []
  readonly property int count: tucked.length
  readonly property bool waiting: replied.length > 0

  FileView {
    id: stateFile
    path: Quickshell.env("HOME") + "/.local/state/omarchy/claude-dock.json"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: {
      try {
        var s = JSON.parse(String(text() || "{}"))
        root.tucked = s.tucked || []
        root.replied = s.replied || []
      } catch (e) { root.tucked = []; root.replied = [] }
    }
  }

  implicitWidth: row.implicitWidth + Style.space(12)
  implicitHeight: barSize

  Row {
    id: row
    anchors.centerIn: parent
    spacing: Style.space(3)
    Text {
      id: star
      textFormat: Text.PlainText
      text: "✳"
      color: root.waiting ? Color.accent : (root.count ? root.bar.barForeground : Qt.darker(root.bar.barForeground, 1.8))
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body
      SequentialAnimation on opacity {
        running: root.waiting
        loops: Animation.Infinite
        onRunningChanged: if (!running) star.opacity = 1
        NumberAnimation { to: 0.25; duration: 550 }
        NumberAnimation { to: 1; duration: 550 }
      }
    }
    Text {
      visible: root.count > 0
      textFormat: Text.PlainText
      text: String(root.count)
      color: root.waiting ? Color.accent : root.bar.barForeground
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.caption
      anchors.verticalCenter: parent.verticalCenter
    }
  }

  MouseArea {
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    acceptedButtons: Qt.LeftButton | Qt.RightButton
    onClicked: function(m) { root.bar.run(m.button === Qt.RightButton ? "claude-dock show-all" : "claude-dock toggle") }
    onEntered: {
      if (!root.bar) return
      var lines = root.tucked.map(function(t) { return (root.replied.indexOf(t.address) >= 0 ? "● " : "  ") + t.title })
      root.bar.showTooltip(root, root.count
        ? "Tucked Claude chats (" + root.count + ")\n" + lines.join("\n") + "\nClick: bring one back · Right click: all · Super+Alt+U"
        : "Claude dock: Super+Alt+U tucks the chat you're in")
    }
    onExited: if (root.bar) root.bar.hideTooltip(root)
  }
}
