import QtQuick
import Qt.labs.folderlistmodel
import Quickshell
import Quickshell.Io
import qs.Ui
import qs.Commons

// NeuroNet Fleeting Note -- a quick thought from the top bar.
//
// Cam: "create another top bar widget that will allow me to type a fleeting
// note".
//
// NeuroNet's Fleeting notes are ordinary Markdown files in the Notes vault,
// "Fleeting note 1.md", "Fleeting note 2.md" ... and the numbers are a queue
// (neuronet.py, fleeting_add). NeuroNet reads that folder from disk every
// time, so this widget writes the next numbered file itself -- it works
// with NeuroNet open or closed, and the note is simply there next time
// Notes → Fleeting is looked at.
//
// Click the icon, type, Ctrl+Enter (or Save). Esc closes; what was typed
// stays until it is saved, so closing by accident loses nothing.
//
// Settings (in the bar layout entry):
//   "folder": the Fleeting folder, if NeuroNet's vault lives elsewhere.
BarWidget {
  id: root
  moduleName: "neuronet.fleeting"

  // where NeuroNet is on this computer (NeuroNetPaths.qml; Stage 1, 2026-09-29)
  NeuroNetPaths { id: nn }
  readonly property string folder: (settings && settings.folder)
    || (nn.dataDir ? nn.dataDir + "/notes/vault/Fleeting" : "")

  property bool opened: false
  property string status: ""          // "Saved as Fleeting note 4"
  property bool saving: false

  function close() { opened = false }

  // How many are waiting -- the same files NeuroNet lists.
  FolderListModel {
    id: notes
    folder: "file://" + root.folder
    nameFilters: ["Fleeting note *.md"]
    showDirs: false
  }

  // The next free number, and the write, in one small shell step so two
  // quick saves can't pick the same number. The text goes in as an
  // argument, never through the script text.
  Process {
    id: writer
    property string out: ""
    stdout: StdioCollector { onStreamFinished: writer.out = this.text.trim() }
    onExited: function(code) {
      root.saving = false
      if (code === 0 && writer.out !== "") {
        root.status = "Saved as Fleeting note " + writer.out
        input.text = ""
        closeLater.restart()
      } else {
        root.status = "Couldn't save it — is the NeuroNet drive mounted?"
      }
    }
  }

  Timer { id: closeLater; interval: 900; onTriggered: { root.opened = false; root.status = "" } }

  function save() {
    var text = input.text
    if (text.trim() === "" || saving) return
    saving = true
    status = ""
    writer.out = ""
    writer.command = ["bash", "-c",
      'set -e; d="$1"; mkdir -p "$d"; n=1; '
      + 'while [ -e "$d/Fleeting note $n.md" ]; do n=$((n+1)); done; '
      + 'printf "%s" "$2" > "$d/Fleeting note $n.md.part"; '
      + 'mv -n "$d/Fleeting note $n.md.part" "$d/Fleeting note $n.md"; echo "$n"',
      "fleeting", root.folder, text]
    writer.running = true
  }

  implicitWidth: glyph.implicitWidth + Style.space(14)
  implicitHeight: barSize

  Text {
    id: glyph
    anchors.centerIn: parent
    textFormat: Text.PlainText
    text: "󱞁"
    color: root.opened ? root.bar.barForeground : Qt.darker(root.bar.barForeground, 1.15)
    font.family: root.bar.fontFamily
    font.pixelSize: Style.font.body
  }

  MouseArea {
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onClicked: root.opened = !root.opened
    onEntered: if (root.bar) root.bar.showTooltip(root, "Fleeting note"
      + (notes.count ? "  ·  " + notes.count + " waiting" : ""))
    onExited: if (root.bar) root.bar.hideTooltip(root)
  }

  KeyboardPanel {
    id: panel
    anchorItem: root
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: input
    contentWidth: panel.fittedContentWidth(Style.space(380))
    contentHeight: panel.fittedContentHeight(column.implicitHeight)

    Column {
      id: column
      anchors.fill: parent
      spacing: Style.space(10)

      Item {
        width: parent.width
        height: heading.implicitHeight

        Text {
          id: heading
          textFormat: Text.PlainText
          text: "Fleeting note"
          color: root.bar.foreground
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.subtitle
          font.bold: true
        }
        Text {
          anchors.right: parent.right
          anchors.verticalCenter: heading.verticalCenter
          textFormat: Text.PlainText
          text: notes.count ? notes.count + " in Fleeting" : "Fleeting is empty"
          color: Qt.darker(root.bar.foreground, 1.5)
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.caption
        }
      }

      BorderSurface {
        width: parent.width
        height: Style.space(140)
        radius: Style.spacing.labelGap
        color: Style.normalFillFor(root.bar.foreground, Color.accent)
        borderSpec: Border.controlSpec(input.activeFocus ? "focus" : "normal",
                                       root.bar.foreground, Color.accent)

        Flickable {
          id: scroller
          anchors.fill: parent
          anchors.margins: Style.space(10)
          contentWidth: width
          contentHeight: input.implicitHeight
          clip: true
          boundsBehavior: Flickable.StopAtBounds
          function follow(r) {
            if (r.y < contentY) contentY = r.y
            else if (r.y + r.height > contentY + height) contentY = r.y + r.height - height
          }

          TextEdit {
            id: input
            width: scroller.width
            wrapMode: TextEdit.Wrap
            color: root.bar.foreground
            selectionColor: Color.accent
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.body
            onCursorRectangleChanged: scroller.follow(cursorRectangle)
            Keys.onPressed: function(e) {
              if ((e.key === Qt.Key_Return || e.key === Qt.Key_Enter)
                  && (e.modifiers & Qt.ControlModifier)) {
                root.save(); e.accepted = true
              } else if (e.key === Qt.Key_Escape) {
                root.opened = false; e.accepted = true
              }
            }

            Text {
              visible: input.text === "" && !input.preeditText
              text: "A quick thought…"
              color: Qt.darker(root.bar.foreground, 1.8)
              font: input.font
            }
          }
        }
      }

      Item {
        width: parent.width
        height: saveBtn.implicitHeight

        Text {
          anchors.left: parent.left
          anchors.right: saveBtn.left
          anchors.rightMargin: Style.space(8)
          anchors.verticalCenter: parent.verticalCenter
          textFormat: Text.PlainText
          text: root.status !== "" ? root.status : "Ctrl+Enter saves  ·  Esc closes"
          color: root.status.indexOf("Couldn't") === 0 ? Color.urgent || "#e06c75"
            : Qt.darker(root.bar.foreground, root.status !== "" ? 1.0 : 1.6)
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.caption
          elide: Text.ElideRight
        }

        Button {
          id: saveBtn
          anchors.right: parent.right
          text: root.saving ? "Saving…" : "Save"
          foreground: root.bar.foreground
          bordered: true
          enabled: input.text.trim() !== "" && !root.saving
          opacity: enabled ? 1.0 : 0.45
          onClicked: root.save()
        }
      }
    }
  }
}
