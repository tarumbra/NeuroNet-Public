import QtQuick
import qs.Commons
import qs.Ui

// The bar glyph for NeuroNet's daily cards (Service.qml does the work).
// The SAME file serves neuronet.tarot (✦), neuronet.oracle (☾) and
// neuronet.lenormand (❖) -- it
// finds which from its folder name. Keep the copies identical.
// A click: today's card(s). (The right click's desktop cards went with the desktop widgets, 3 Nov 2026.)
BarWidget {
  id: root
  readonly property string pluginDir: decodeURIComponent(String(Qt.resolvedUrl("."))).replace(/\/$/, "")
  readonly property string pluginId: pluginDir.substring(pluginDir.lastIndexOf("/") + 1)
  moduleName: pluginId
  implicitWidth: glyph.implicitWidth
  implicitHeight: glyph.implicitHeight

  function service() {
    return root.bar && root.bar.shell ? root.bar.shell.serviceFor(root.pluginId) : null
  }
  readonly property var svc: service()
  readonly property var cards: svc ? svc.todayCards : []
  readonly property var kinds: svc ? svc.kinds : []
  readonly property string title: svc ? kinds.map(function(k) { return svc.kindNames[k] }).join(" & ") : ""

  WidgetButton {
    id: glyph
    anchors.fill: parent
    bar: root.bar
    text: root.svc ? root.svc.tool.glyph : "✦"
    fontSize: Style.font.iconLarge
    // bright once every kind has today's card
    foreground: root.kinds.length && root.cards.length >= root.kinds.length ? Color.accent : Qt.darker(Color.accent, 1.35)
    horizontalMargin: 9
    tooltipText: (root.cards.length
      ? root.cards.map(function(c) {
          return (root.kinds.length > 1 ? root.svc.kindNames[c.kind] + ": " : "Today: ")
            + c.name + (c.reversed ? " (reversed)" : "") + " · " + c.deckName
        }).join("\n")
        + (root.cards.length < root.kinds.length ? "\nStill to pull: " + root.kinds.filter(function(k) {
            return !root.svc.todayFor(k) }).map(function(k) { return root.svc.kindNames[k] }).join(", ") : "")
      : "NeuroNet " + root.title + " · pull today's card")
    onPressed: function(button) {
      var s = root.service()
      if (!s) return
      s.toggleReading()
    }
  }
}
