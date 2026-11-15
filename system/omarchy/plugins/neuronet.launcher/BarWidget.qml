import QtQuick
import Quickshell
import Quickshell.Services.Mpris
import qs.Ui
import qs.Commons

// NeuroNet Quick Access -- NeuroNet's tools as a popup.
//
// Cam: "a plugin that can load my tools in Neuronet and make them appear as a
// popup that i can do some quick work or viewing, rather then having to open
// the whole app all the time." Then: "the rest of the short cuts for every
// tool in Neuronet" -- so every main section is here, Cashbox being
// NeuroNet's Money section.
//
// Each entry runs neuronet-quick (beside neuronet.py), which floats NeuroNet
// itself over the screen on that tool -- the same one NeuroNet, so nothing
// is loaded twice. The same keys work anywhere: Super+Alt+N/T/P/M, and
// Super+Alt+O for the whole app.
BarWidget {
  id: root
  moduleName: "neuronet.launcher"

  // on the PATH, wherever NeuroNet is (neuronet-setup; Stage 1, 2026-09-29)
  readonly property string quick: "neuronet-quick"
  // Every NeuroNet tool, in the order of NeuroNet's own left menu.
  readonly property var tools: [
    { key: "photos", name: "Photos", glyph: "󰉏", keys: "Super+Alt+P" },
    { key: "mind", name: "Mindfulness", glyph: "󰌪", keys: "Super+Alt+Z" },
    { key: "money", name: "Cashbox", glyph: "󰄔", keys: "Super+Alt+C" },
    { key: "games", name: "Puzzles", glyph: "󰐱", keys: "Super+Alt+Q" },
    { key: "divination", name: "Divination", glyph: "✦", keys: "Super+Alt+D" },
    // M&T (2026-10-02): Music and Stuff are one section now -- M opens its
    // music pages, I its media pages (neuronet-quick music | stuff).
    { key: "stuff", name: "M&T", glyph: "󰏗", keys: "Super+Alt+M · I" },
    { key: "cookery", name: "Kitchen", glyph: "󰩰", keys: "Super+Alt+R" },
    { key: "training", name: "Training", glyph: "󰔛", keys: "Super+Alt+T" },
    { key: "home", name: "Home", glyph: "󰋜", keys: "Super+Alt+H" },
    { key: "notes", name: "Scribe", glyph: "󰠮", keys: "Super+Alt+N" },
    { key: "creative", name: "Creative", glyph: "󰏘", keys: "Super+Alt+B" },
    { key: "code", name: "Code", glyph: "󰅩", keys: "Super+Alt+E" }
  ]
  // NeuroNet is running when its player is on the media bus.
  readonly property bool running: {
    var list = Mpris.players ? Mpris.players.values : []
    for (var i = 0; i < list.length; i++)
      if (list[i] && list[i].dbusName === "org.mpris.MediaPlayer2.neuronet") return true
    return false
  }

  property bool popupOpen: false
  function close() { popupOpen = false }
  function go(action) {
    // "full" toggles (Super+Alt+O hides it again); from this menu the whole
    // app should always come forward, so it asks for "show".
    if (action === "full") action = "show"
    popupOpen = false
    root.bar.run(root.quick + " " + action)
  }

  implicitWidth: glyph.implicitWidth + Style.space(14)
  implicitHeight: barSize

  Text {
    id: glyph
    anchors.centerIn: parent
    textFormat: Text.PlainText
    text: "󰧑"
    color: root.running ? root.bar.barForeground : Qt.darker(root.bar.barForeground, 1.8)
    font.family: root.bar.fontFamily
    font.pixelSize: Style.font.body
  }

  MouseArea {
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    acceptedButtons: Qt.LeftButton | Qt.MiddleButton
    onClicked: function(m) {
      if (m.button === Qt.MiddleButton) root.go("toggle")
      else root.popupOpen = !root.popupOpen
    }
    onEntered: if (root.bar) root.bar.showTooltip(root, "NeuroNet quick access"
      + (root.running ? "" : " · NeuroNet will open"))
    onExited: if (root.bar) root.bar.hideTooltip(root)
  }

  PopupCard {
    id: popup
    anchorItem: root
    bar: root.bar
    owner: root
    open: root.popupOpen
    contentWidth: popup.fittedContentWidth(Style.space(270))
    contentHeight: popup.fittedContentHeight(column.implicitHeight)

    Column {
      id: column
      anchors.fill: parent
      spacing: Style.space(4)

      Text {
        textFormat: Text.PlainText
        text: "NeuroNet"
        color: root.bar.foreground
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.subtitle
        font.bold: true
        bottomPadding: Style.space(4)
      }

      Repeater {
        model: root.tools.concat([{ key: "full", name: "Whole NeuroNet", glyph: "󰊓", keys: "Super+Alt+O" }])
        BorderSurface {
          id: row
          required property var modelData
          width: column.width
          height: rowInner.implicitHeight + Style.space(12)
          radius: Style.spacing.labelGap
          color: rowMouse.containsMouse ? Style.selectedFillFor(root.bar.foreground, Color.accent) : "transparent"
          borderSpec: rowMouse.containsMouse ? Border.controlSpec("normal", root.bar.foreground, Color.accent) : Border.none()

          Row {
            id: rowInner
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            anchors.leftMargin: Style.space(10)
            anchors.rightMargin: Style.space(10)
            spacing: Style.space(10)
            Text {
              width: Style.space(20)
              horizontalAlignment: Text.AlignHCenter
              text: row.modelData.glyph
              color: Color.accent
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body
            }
            Text {
              width: parent.width - Style.space(20) - keysText.implicitWidth - Style.space(20)
              textFormat: Text.PlainText
              text: row.modelData.name
              color: root.bar.foreground
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.body
              elide: Text.ElideRight
            }
            Text {
              id: keysText
              textFormat: Text.PlainText
              text: row.modelData.keys
              color: Qt.darker(root.bar.foreground, 1.6)
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.caption
              anchors.verticalCenter: parent.verticalCenter
            }
          }
          MouseArea {
            id: rowMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.go(row.modelData.key)
          }
        }
      }

      Text {
        width: column.width
        topPadding: Style.space(6)
        textFormat: Text.PlainText
        text: "Press a tool's keys again to put it away."
        color: Qt.darker(root.bar.foreground, 1.7)
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.caption
        wrapMode: Text.WordWrap
      }
    }
  }
}
