import QtQuick
import Quickshell
import Quickshell.Wayland
import Quickshell.Hyprland
import qs.Commons

// Window snap outline (16 Nov 2026). ~/.config/hypr/windowsnap.lua watches a
// drag and sends Hyprland custom events:
//   neurosnap show <x> <y> <w> <h> <monitor>   (global logical px)
//   neurosnap hide
// This draws the zone as a see-through accent box. Nothing runs between
// drags: the window only exists while it is shown (or fading out), and it
// lets every click through.
Item {
  id: root
  property bool on: false
  property string mon: ""
  property real zx: 0
  property real zy: 0
  property real zw: 0
  property real zh: 0

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      if (event.name !== "custom") return
      var d = String(event.data)
      if (d.indexOf("neurosnap ") !== 0) return
      var p = d.split(" ")
      if (p[1] === "show" && p.length >= 7) {
        root.mon = p[6]
        root.zx = Number(p[2]); root.zy = Number(p[3])
        root.zw = Number(p[4]); root.zh = Number(p[5])
        root.on = true
      } else {
        root.on = false
      }
    }
  }

  PanelWindow {
    id: win
    readonly property var target: {
      var list = Quickshell.screens
      for (var i = 0; i < list.length; i++) if (list[i].name === root.mon) return list[i]
      return list.length ? list[0] : null
    }
    screen: target
    visible: root.on || box.opacity > 0.01
    color: "transparent"
    WlrLayershell.namespace: "neuronet.snap"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
    exclusionMode: ExclusionMode.Ignore
    anchors { top: true; bottom: true; left: true; right: true }
    mask: Region {}

    Rectangle {
      id: box
      readonly property real inset: 6
      x: root.zx - (win.target ? win.target.x : 0) + inset
      y: root.zy - (win.target ? win.target.y : 0) + inset
      width: Math.max(0, root.zw - 2 * inset)
      height: Math.max(0, root.zh - 2 * inset)
      radius: 10
      color: Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.16)
      border.color: Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.85)
      border.width: 2
      opacity: root.on ? 1 : 0
      Behavior on opacity { NumberAnimation { duration: 120 } }
      Behavior on x { enabled: root.on; NumberAnimation { duration: 110; easing.type: Easing.OutCubic } }
      Behavior on y { enabled: root.on; NumberAnimation { duration: 110; easing.type: Easing.OutCubic } }
      Behavior on width { enabled: root.on; NumberAnimation { duration: 110; easing.type: Easing.OutCubic } }
      Behavior on height { enabled: root.on; NumberAnimation { duration: 110; easing.type: Easing.OutCubic } }
    }
  }
}
