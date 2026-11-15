import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import Quickshell.Hyprland
import qs.Commons
import qs.Ui

// NeuroNet daily cards -- Tarot (neuronet.tarot), Oracle (neuronet.oracle)
// and Lenormand (neuronet.lenormand). THIS ONE FILE IS ALL THREE PLUGINS: the copy in each plugin
// folder is identical, and it works out which one it is from its own
// folder name (see `tools` below). Keep them identical --
// test/test_daily_cards.py in NeuroNet checks.
//
// Cam: "build a top bar tarot tool like the Ominity that is already
// installed" -- and later: "for the card pull, please seperate into 2
// tools. Keep the current one for tarot but also make one for both oracle
// and lenormand as well. This way i can pull one of each cards each day,
// then present them side by side on the desktop." -- and on 2026-10-01:
// "Lets seperate oracle and lenormand like tarot this will stop ambiguity
// when pulling a card and allow them to be handled independtly." (One tool
// for both remembered the last kind used, so the Today card's Oracle slot
// could open on Lenormand and the pull landed in the other slot.)
//
// Like Ominity: click the bar glyph and a card lies face-down in the middle
// of the screen; click it (or Space) to turn it over. One card a day PER
// KIND (tarot; oracle; lenormand), kept until "Draw again". (Today's cards
// on the desktop went with the desktop widgets, 3 Nov 2026.)
//
// The cards are NeuroNet's: the decks in neuronet_data/cards/celestial.json,
// with their own pictures and Cam's own upright / reversed meanings.
// Reversed half the time, as NeuroNet's own pulls are. "Save to Journal"
// puts the pull in NeuroNet's Journal (Mindfulness → Journal), card picture
// and all, through NeuroNet's journal.py (journal_add.py beside this file).
//
// It only READS the decks. Its own state (today's cards, the last pulls,
// the decks chosen, the desktop cards on/off) is kept in
// ~/.local/state/neuronet-tarot/, neuronet-oracle/ or neuronet-lenormand/
// state.json. Lenormand used to live in neuronet-oracle's file; the first
// time neuronet.lenormand has no file of its own it takes its pulls (and the
// desktop on/off) from there.
Item {
  id: root

  property var shell: null
  property var manifest: null
  property var pluginRegistry: null

  // where NeuroNet is on this computer (NeuroNetPaths.qml; Stage 1, 2026-09-29)
  NeuroNetPaths { id: nn }
  readonly property string app: nn.app
  readonly property string cardsDir: nn.dataDir ? nn.dataDir + "/cards" : ""
  readonly property string home: Quickshell.env("HOME")
  readonly property string pluginDir: decodeURIComponent(String(Qt.resolvedUrl("."))).replace(/^file:\/\//, "").replace(/\/$/, "")
  readonly property string pluginId: pluginDir.substring(pluginDir.lastIndexOf("/") + 1)

  // Which tool this copy is.
  readonly property var tools: ({
    "neuronet.tarot": { kinds: ["tarot"], state: "neuronet-tarot", glyph: "✦" },
    "neuronet.oracle": { kinds: ["oracle"], state: "neuronet-oracle", glyph: "☾" },
    "neuronet.lenormand": { kinds: ["lenormand"], state: "neuronet-lenormand", from: "neuronet-oracle", glyph: "❖" }
  })
  readonly property var tool: tools[pluginId] || tools["neuronet.tarot"]
  readonly property var kinds: tool.kinds
  readonly property var kindNames: ({ tarot: "Tarot", oracle: "Oracle", lenormand: "Lenormand" })
  readonly property string stateDir: home + "/.local/state/" + tool.state

  readonly property color ink: Color.popups.text
  readonly property color paper: Color.popups.background
  readonly property color accent: Color.accent

  // ---- state -----------------------------------------------------------
  // days: { <kind>: today's pull of that kind }; deckIds: { <kind>: deck id | "any" }
  // desktopCard: the old desktop card's switch, kept only so an older state file still reads (the desktop widgets went
  // on 3 Nov 2026 -- Cam: "Lets remove the widget functionality completly")
  property var st: ({ kind: kinds[0], deckIds: ({}), desktopCard: false, days: ({}), history: [] })
  property var decks: ({ tarot: [], oracle: [], lenormand: [] })
  property bool overlayOpen: false
  property real flip: 0            // 0 face-down, 1 face-up
  property var viewing: null       // a past pull being looked at, or null
  property string journalStatus: ""
  property bool journalBusy: false

  function todayStr() { return Qt.formatDate(new Date(), "yyyy-MM-dd") }
  // Re-checked every half minute, so yesterday's cards step aside at midnight.
  property string dayKey: todayStr()
  Timer { interval: 30000; running: true; repeat: true; onTriggered: root.dayKey = root.todayStr() }

  function todayFor(kind) {
    var p = (st.days || {})[kind]
    return p && p.date === dayKey ? p : null
  }
  readonly property var today: todayFor(st.kind)
  readonly property var todayCards: kinds.map(function(k) { return todayFor(k) }).filter(function(p) { return !!p })
  readonly property var shown: viewing || today

  // Old state files (one card a day, of any kind) come in as today's card
  // of their kind -- if that kind belongs to this tool.
  function fromFile(s) {
    var days = {}, deckIds = {}
    kinds.forEach(function(k) {
      if (s.days && s.days[k]) days[k] = s.days[k]
      if (s.deckIds && s.deckIds[k]) deckIds[k] = s.deckIds[k]
    })
    if (s.today && kinds.indexOf(s.today.kind) !== -1 && !days[s.today.kind]) days[s.today.kind] = s.today
    if (!s.deckIds && s.deckId && kinds.indexOf(s.kind) !== -1) deckIds[s.kind] = s.deckId
    return {
      kind: kinds.indexOf(s.kind) !== -1 ? s.kind : kinds[0],
      deckIds: deckIds,
      desktopCard: s.desktopCard === true,
      days: days,
      history: (Array.isArray(s.history) ? s.history : []).filter(function(p) { return kinds.indexOf(p.kind) !== -1 })
    }
  }

  FileView {
    id: stateFile
    path: root.stateDir + "/state.json"
    printErrors: false
    // watched: NeuroNet's Settings -> Desktop widgets can hide or show the cards
    watchChanges: true
    onFileChanged: reload()
    property bool gone: false
    onLoaded: {
      gone = false
      try {
        var s = JSON.parse(text())
        // only an on/off so far (NeuroNet's Settings can write that first)
        if (root.tool.from && !s.days && !s.history) root.adoptOld(s)
        else root.st = root.fromFile(s)
      } catch (e) {}
    }
    onLoadFailed: { gone = true; root.adoptOld({}) }
  }
  // Not there when the shell started (a fresh install, before the first pull):
  // never watched (Quickshell 0.3), so NeuroNet's Settings switching the card
  // on went unseen -- look again until it's there.
  Timer {
    interval: 3000; repeat: true
    running: stateFile.gone && !root.unsaved
    onTriggered: stateFile.reload()
  }
  // no state file yet: this tool's pulls from the file it used to share
  FileView {
    id: oldFile
    path: root.tool.from ? root.home + "/.local/state/" + root.tool.from + "/state.json" : ""
    blockLoading: true
    printErrors: false
  }
  function adoptOld(own) {
    if (!tool.from) return
    var s = {}
    try { s = JSON.parse(oldFile.text()) } catch (e) {}
    if (own.desktopCard !== undefined) s.desktopCard = own.desktopCard
    saveState(fromFile(s))
  }

  // the folder first, then the file: written before mkdir is done, a new
  // tool's first save (neuronet-lenormand, 2026-10-01) could be lost
  property bool dirMade: false
  property string unsaved: ""
  function saveState(next) {
    st = next
    var text = JSON.stringify(next, null, 1)
    if (dirMade) { stateFile.setText(text); return }
    unsaved = text
    mkdir.running = true
  }
  function patch(changes) {
    var n = {}
    for (var k in st) n[k] = st[k]
    for (var c in changes) n[c] = changes[c]
    saveState(n)
  }
  Process {
    id: mkdir
    command: ["mkdir", "-p", root.stateDir]
    onExited: { root.dirMade = true; if (root.unsaved) stateFile.setText(root.unsaved); root.unsaved = "" }
  }

  FileView {
    id: deckFile
    path: root.cardsDir ? root.cardsDir + "/celestial.json" : ""
    watchChanges: true
    onFileChanged: reload()
    onLoaded: {
      try {
        var d = JSON.parse(text())
        var usable = function(list) {
          return (list || []).map(function(dk) {
            return { id: dk.id, name: dk.name, cardBack: dk.cardBack || "",
                     cards: (dk.cards || []).filter(function(c) { return !!c.image }) }
          }).filter(function(dk) { return dk.cards.length > 0 })
        }
        root.decks = { tarot: usable(d.tarotDecks), oracle: usable(d.oracleDecks),
                       lenormand: usable(d.lenormandDecks) }
      } catch (e) {}
    }
  }

  readonly property var kindDecks: decks[st.kind] || []
  readonly property string deckId: (st.deckIds || {})[st.kind] || "any"
  function chooseDeck(id) {
    var d = {}
    for (var k in st.deckIds) d[k] = st.deckIds[k]
    d[st.kind] = id
    patch({ deckIds: d })
  }
  function withDay(kind, pull) {
    var d = {}
    for (var k in st.days) d[k] = st.days[k]
    d[kind] = pull
    return d
  }

  function imageUrl(name) {
    return name ? "file://" + root.cardsDir + "/images/" + encodeURIComponent(name) : ""
  }
  function plainText(v) {
    // A few v283 meanings were rich-text runs; NeuroNet flattens them on
    // load, and so does this.
    if (Array.isArray(v)) return v.map(function(r) { return Array.isArray(r) ? r[0] : String(r) }).join("")
    return String(v || "")
  }

  // ---- drawing -----------------------------------------------------------
  function draw() {
    var pool = kindDecks
    if (!pool.length) return
    var deck = null
    if (deckId !== "any")
      for (var i = 0; i < pool.length; i++) if (pool[i].id === deckId) deck = pool[i]
    if (!deck) deck = pool[Math.floor(Math.random() * pool.length)]
    var card = deck.cards[Math.floor(Math.random() * deck.cards.length)]
    var reversed = Math.random() < 0.5
    var pull = {
      date: todayStr(), at: new Date().toISOString(),
      kind: st.kind, deckId: deck.id, deckName: deck.name, cardBack: deck.cardBack,
      cardId: card.id, name: card.name, suit: card.suit || "", image: card.image,
      reversed: reversed,
      meaning: plainText(reversed ? card.reversed : card.upright),
      other: plainText(reversed ? card.upright : card.reversed),
      synopsis: plainText(card.synopsis),
      saved: false
    }
    var hist = [pull].concat(st.history || []).slice(0, 30)
    patch({ days: withDay(st.kind, pull), history: hist })
    journalStatus = ""
    note.text = ""
  }

  function turn() {
    if (guideFlip > 0.5) { toggleGuide(); return }      // the guide side: a click turns back to the picture
    if (viewing) return
    if (!today) draw()
    flipAnim.to = flip > 0.5 ? 0 : 1
    flipAnim.restart()
  }

  function redraw() {
    plainGuide()
    viewing = null
    flipAnim.stop()
    flip = 0
    draw()
    flipLater.restart()
  }
  Timer { id: flipLater; interval: 260; onTriggered: { flipAnim.to = 1; flipAnim.restart() } }

  NumberAnimation {
    id: flipAnim
    target: root; property: "flip"
    duration: 620; easing.type: Easing.InOutCubic
  }

  // THE GUIDE SIDE (2026-10-02). Cam: "when i pull a card and flip it i want
  // the ability to right click and have the card flip and reveal the guide
  // information on the card on a purple and black gradient background, where
  // purple takes the top of the card and 90% down the card while near the
  // bottom it transitions to black. This should work on the three types of
  // card i pull." Right-click the turned card: it turns again, to its guide;
  // right-click (or click) and it turns back to the picture.
  property real guideFlip: 0         // 0 the picture, 1 the guide
  NumberAnimation { id: guideAnim; target: root; property: "guideFlip"; duration: 560; easing.type: Easing.InOutCubic }
  function toggleGuide() {
    if (!shown || (!viewing && flip < 0.5)) return
    guideAnim.to = guideFlip > 0.5 ? 0 : 1
    guideAnim.restart()
  }
  function plainGuide() { guideAnim.stop(); guideFlip = 0 }

  // Cam (2026-10-02): "When closing the card reader via the close pill, it
  // opens one of the Neuronet apps up i want it to default back to the
  // desktop." What the screen showed when the reading opened -- NeuroNet's
  // popup up or not -- is what it goes back to when the reading closes.
  readonly property string popupCheck: "hyprctl monitors -j | jq -r '[.[] | select(.focused)][0].specialWorkspace.name // \"\"'"
  property bool popupWasUp: false
  Process {
    id: popupAtOpen
    command: ["bash", "-c", root.popupCheck]
    stdout: StdioCollector { onStreamFinished: root.popupWasUp = this.text.trim() === "special:neuronet" }
  }
  Timer {
    id: backToDesktop
    interval: 250
    onTriggered: if (!root.popupWasUp)
      Quickshell.execDetached(["bash", "-c", "[ \"$(" + root.popupCheck + ")\" = special:neuronet ] && exec neuronet-quick hide"])
  }

  function open() {
    if (!overlayOpen) { popupWasUp = false; popupAtOpen.running = true }
    plainGuide()
    viewing = null
    flip = today ? 1 : 0
    journalStatus = today && today.saved ? "Saved to Journal" : ""
    note.text = ""
    overlayOpen = true
  }
  // Switch between this tool's kinds (Oracle / Lenormand), or open on one.
  function showKind(kind) {
    if (kinds.indexOf(kind) === -1) return
    flipAnim.stop()
    if (st.kind !== kind) patch({ kind: kind })
    open()
  }
  function close() {
    if (overlayOpen) backToDesktop.restart()
    overlayOpen = false; viewing = null
  }
  function toggleReading() { overlayOpen ? close() : open() }

  // ---- journal -------------------------------------------------------------
  Process {
    id: journalProc
    stdinEnabled: true
    property string out: ""
    property var pull: null
    command: ["python3", root.pluginDir + "/journal_add.py"]
    stdout: StdioCollector { onStreamFinished: journalProc.out = this.text }
    onStarted: {
      var p = journalProc.pull
      write(JSON.stringify({
        app: root.app, kind: p.kind, deckName: p.deckName, text: note.text,
        card: { name: p.name, image: p.image, reversed: p.reversed, meaning: p.meaning }
      }))
      stdinEnabled = false
    }
    onExited: {
      root.journalBusy = false
      stdinEnabled = true
      var res = {}
      try { res = JSON.parse(journalProc.out) } catch (e) { res = { error: "Couldn't save it." } }
      if (res.ok) {
        root.journalStatus = "Saved to Journal"
        var t = {}
        for (var k in journalProc.pull) t[k] = journalProc.pull[k]
        t.saved = true
        var hist = (root.st.history || []).map(function(h) { return h.at === t.at ? t : h })
        var cur = root.todayFor(t.kind)
        root.patch(cur && cur.at === t.at ? { days: root.withDay(t.kind, t), history: hist } : { history: hist })
      } else {
        root.journalStatus = res.error || "Couldn't save it."
      }
    }
  }
  function saveToJournal() {
    if (!today || journalBusy) return
    journalBusy = true
    journalStatus = ""
    journalProc.out = ""
    journalProc.pull = today
    journalProc.running = true
  }

  IpcHandler {
    target: root.pluginId
    function open(): void { root.open() }
    function close(): void { root.close() }
    function toggle(): void { root.toggleReading() }
    function redraw(): void { root.open(); root.redraw() }
    function state(): string { return JSON.stringify({ reading: root.overlayOpen }) }
  }

  // ---- the reading -----------------------------------------------------------
  PanelWindow {
    id: stage
    visible: root.overlayOpen || fade.opacity > 0.01
    color: "transparent"
    WlrLayershell.namespace: root.pluginId
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: root.overlayOpen ? WlrKeyboardFocus.Exclusive : WlrKeyboardFocus.None
    exclusionMode: ExclusionMode.Ignore
    anchors { top: true; bottom: true; left: true; right: true }

    Item {
      id: fade
      anchors.fill: parent
      opacity: root.overlayOpen ? 1 : 0
      Behavior on opacity { NumberAnimation { duration: 180 } }
      focus: true
      Keys.onPressed: function(e) {
        if (e.key === Qt.Key_Escape) { root.close(); e.accepted = true }
        else if (e.key === Qt.Key_Space && !note.activeFocus) { root.turn(); e.accepted = true }
      }
      onVisibleChanged: if (visible) forceActiveFocus()

      Rectangle { anchors.fill: parent; color: Util.alpha("#000000", 0.62) }
      MouseArea { anchors.fill: parent; onClicked: root.close() }

      Row {
        id: layout
        anchors.centerIn: parent
        spacing: Style.space(40)
        readonly property real cardH: Math.min(parent.height * 0.78, 640)
        readonly property real cardW: cardH * 0.58

        // the card
        Item {
          id: cardItem
          width: layout.cardW
          height: layout.cardH
          readonly property real face: root.viewing ? 1 : root.flip
          readonly property bool showingGuide: root.guideFlip >= 0.5
          transform: Scale {
            origin.x: cardItem.width / 2
            xScale: Math.max(0.02, Math.abs(Math.cos(Math.PI * (cardItem.face + root.guideFlip))))
          }

          // back
          Rectangle {
            anchors.fill: parent
            visible: cardItem.face < 0.5
            radius: Style.space(16)
            border.width: 2
            border.color: Util.alpha(root.accent, 0.8)
            gradient: Gradient {
              GradientStop { position: 0.0; color: Qt.darker(root.accent, 2.6) }
              GradientStop { position: 1.0; color: Qt.darker(root.accent, 4.2) }
            }
            Image {
              anchors.fill: parent
              anchors.margins: 6
              visible: !!(root.today && root.today.cardBack)
              sourceSize.width: 600      // a card back, not a poster
              sourceSize.height: 600
              source: root.today && root.today.cardBack ? root.imageUrl(root.today.cardBack) : ""
              fillMode: Image.PreserveAspectCrop
            }
            Rectangle {
              anchors.fill: parent
              anchors.margins: Style.space(14)
              radius: Style.space(10)
              color: "transparent"
              border.width: 1
              border.color: Util.alpha(root.accent, 0.45)
            }
            Text {
              anchors.centerIn: parent
              text: "✦"
              color: root.accent
              font.pixelSize: layout.cardW * 0.3
            }
            Text {
              anchors.horizontalCenter: parent.horizontalCenter
              anchors.bottom: parent.bottom
              anchors.bottomMargin: Style.space(28)
              text: root.kindDecks.length ? "Click to turn over" : "No decks with pictures yet"
              color: Util.alpha(root.ink, 0.75)
              font.family: Style.font.family
              font.pixelSize: Style.font.bodySmall
            }
          }

          // face
          Rectangle {
            anchors.fill: parent
            visible: cardItem.face >= 0.5 && !cardItem.showingGuide
            radius: Style.space(16)
            color: "#111111"
            clip: true
            Image {
              anchors.fill: parent
              anchors.margins: 4
              fillMode: Image.PreserveAspectFit
              asynchronous: true
              sourceSize.height: 1400
              source: root.shown ? root.imageUrl(root.shown.image) : ""
              rotation: root.shown && root.shown.reversed ? 180 : 0
            }
          }

          // the guide: purple most of the way down, into black at the foot
          Rectangle {
            id: guideFace
            anchors.fill: parent
            visible: cardItem.showingGuide
            radius: Style.space(16)
            clip: true
            border.width: 1
            border.color: Util.alpha("#c9a7ff", 0.45)
            gradient: Gradient {
              GradientStop { position: 0.0; color: "#5a2a9c" }
              GradientStop { position: 0.9; color: "#3b1670" }
              GradientStop { position: 1.0; color: "#000000" }
            }
            readonly property var p: root.shown
            readonly property string upright: p ? (p.reversed ? p.other : p.meaning) || "" : ""
            readonly property string reversedText: p ? (p.reversed ? p.meaning : p.other) || "" : ""
            Flickable {
              id: guideScroll
              anchors.fill: parent
              anchors.margins: Style.space(18)
              contentWidth: width; contentHeight: guideCol.implicitHeight
              clip: true
              boundsBehavior: Flickable.StopAtBounds
              Column {
                id: guideCol
                width: parent.width
                spacing: Style.space(8)
                Text { width: parent.width; wrapMode: Text.WordWrap; horizontalAlignment: Text.AlignHCenter
                       text: root.shown ? root.shown.name : ""; color: "#ffffff"
                       font.family: Style.font.family; font.pixelSize: Style.font.subtitle * 1.25; font.bold: true }
                Text { width: parent.width; wrapMode: Text.WordWrap; horizontalAlignment: Text.AlignHCenter
                       text: root.shown ? [root.kindNames[root.shown.kind] || "", root.shown.suit || "", root.shown.deckName || ""]
                                          .filter(function(x) { return x }).join("  ·  ") : ""
                       color: "#d8c4ff"; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                Rectangle { width: parent.width * 0.4; height: 1; anchors.horizontalCenter: parent.horizontalCenter; color: Util.alpha("#ffffff", 0.35) }
                Text { text: "UPRIGHT" + (root.shown && !root.shown.reversed ? "  ·  this one" : ""); color: "#e9dcff"
                       font.family: Style.font.family; font.pixelSize: Style.font.caption; font.bold: true; font.letterSpacing: 1 }
                Text { width: parent.width; wrapMode: Text.WordWrap; color: "#ffffff"; lineHeight: 1.2
                       text: guideFace.upright || "No upright meaning written yet."
                       font.family: Style.font.family; font.pixelSize: Style.font.bodySmall }
                Text { text: "REVERSED" + (root.shown && root.shown.reversed ? "  ·  this one" : ""); color: "#e9dcff"; topPadding: 4
                       font.family: Style.font.family; font.pixelSize: Style.font.caption; font.bold: true; font.letterSpacing: 1 }
                Text { width: parent.width; wrapMode: Text.WordWrap; color: "#ffffff"; lineHeight: 1.2
                       text: guideFace.reversedText || "No reversed meaning written yet."
                       font.family: Style.font.family; font.pixelSize: Style.font.bodySmall }
                Text { visible: !!(root.shown && root.shown.synopsis); text: "ABOUT"; color: "#e9dcff"; topPadding: 4
                       font.family: Style.font.family; font.pixelSize: Style.font.caption; font.bold: true; font.letterSpacing: 1 }
                Text { visible: !!(root.shown && root.shown.synopsis); width: parent.width; wrapMode: Text.WordWrap
                       color: Util.alpha("#ffffff", 0.85); font.italic: true; lineHeight: 1.2
                       text: root.shown ? root.shown.synopsis || "" : ""
                       font.family: Style.font.family; font.pixelSize: Style.font.bodySmall }
              }
            }
          }

          MouseArea {
            anchors.fill: parent
            acceptedButtons: Qt.LeftButton | Qt.RightButton
            cursorShape: Qt.PointingHandCursor
            // right-click: the guide side (once it's turned); left: turn it over / back
            onClicked: function(m) { if (m.button === Qt.RightButton) root.toggleGuide(); else root.turn() }
            // the guide scrolls with the wheel (this area sits over it)
            onWheel: function(w) {
              if (!cardItem.showingGuide) { w.accepted = false; return }
              var max = Math.max(0, guideScroll.contentHeight - guideScroll.height)
              guideScroll.contentY = Math.max(0, Math.min(max, guideScroll.contentY - w.angleDelta.y / 2))
            }
          }
        }

        // the reading
        Rectangle {
          id: side
          width: Math.min(460, fade.width - layout.cardW - Style.space(120))
          height: layout.cardH
          radius: Style.space(16)
          color: Util.alpha(root.paper, 0.96)
          border.width: 1
          border.color: Util.alpha(root.ink, 0.14)
          MouseArea { anchors.fill: parent }        // clicks here don't close

          Flickable {
            id: sideScroll
            anchors.fill: parent
            anchors.margins: Style.space(22)
            contentWidth: width
            contentHeight: sideCol.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds

            Column {
              id: sideCol
              width: sideScroll.width
              spacing: Style.space(12)

              Text {
                readonly property string what: root.kinds.length > 1 ? "Today's " + root.kindNames[root.st.kind] + " card" : "Today's card"
                text: root.viewing ? "A past pull · " + root.viewing.date
                  : (root.today ? what : what + " is waiting")
                color: Util.alpha(root.ink, 0.6)
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
                font.bold: true
                font.letterSpacing: 1
              }

              // what the card is -- once it is turned
              Column {
                width: parent.width
                spacing: Style.space(6)
                visible: !!root.shown && (root.viewing || root.flip > 0.5)
                Text {
                  width: parent.width
                  text: root.shown ? root.shown.name : ""
                  color: root.ink
                  font.family: Style.font.family
                  font.pixelSize: Style.font.displayLarge || Style.font.subtitle * 1.6
                  font.bold: true
                  wrapMode: Text.WordWrap
                }
                Text {
                  width: parent.width
                  text: root.shown ? (root.shown.reversed ? "Reversed" : "Upright") + "  ·  " + root.shown.deckName
                    + (root.kinds.length > 1 ? "  ·  " + root.kindNames[root.shown.kind] : "") : ""
                  color: root.accent
                  font.family: Style.font.family
                  font.pixelSize: Style.font.body
                  wrapMode: Text.WordWrap
                }
                Text {
                  width: parent.width
                  topPadding: Style.space(8)
                  text: root.shown ? (root.shown.meaning || "No meaning written for this card yet — add one in NeuroNet → Divination.") : ""
                  color: root.ink
                  font.family: Style.font.family
                  font.pixelSize: Style.font.body
                  lineHeight: 1.25
                  wrapMode: Text.WordWrap
                }
                Text {
                  width: parent.width
                  visible: !!(root.shown && root.shown.synopsis)
                  text: root.shown ? root.shown.synopsis : ""
                  color: Util.alpha(root.ink, 0.7)
                  font.family: Style.font.family
                  font.pixelSize: Style.font.bodySmall
                  font.italic: true
                  wrapMode: Text.WordWrap
                }
              }

              Text {
                width: parent.width
                visible: !root.shown || (!root.viewing && root.flip <= 0.5)
                text: root.today ? "Turn the card over to read it."
                  : "Choose where the card comes from, then click the card (or press Space)."
                color: Util.alpha(root.ink, 0.8)
                font.family: Style.font.family
                font.pixelSize: Style.font.body
                wrapMode: Text.WordWrap
              }

              // journal
              Column {
                width: parent.width
                spacing: Style.space(8)
                visible: !root.viewing && !!root.today && root.flip > 0.5
                PanelSeparator { foreground: root.ink }
                Text {
                  text: "A note for the Journal (optional)"
                  color: Util.alpha(root.ink, 0.6)
                  font.family: Style.font.family
                  font.pixelSize: Style.font.caption
                }
                BorderSurface {
                  width: parent.width
                  height: Style.space(84)
                  radius: Style.spacing.labelGap
                  color: Style.normalFillFor(root.ink, root.accent)
                  borderSpec: Border.controlSpec(note.activeFocus ? "focus" : "normal", root.ink, root.accent)
                  TextEdit {
                    id: note
                    anchors.fill: parent
                    anchors.margins: Style.space(8)
                    wrapMode: TextEdit.Wrap
                    color: root.ink
                    selectionColor: root.accent
                    font.family: Style.font.family
                    font.pixelSize: Style.font.bodySmall
                    clip: true
                    Keys.onPressed: function(e) {
                      if (e.key === Qt.Key_Escape) { fade.forceActiveFocus(); e.accepted = true }
                    }
                    Text {
                      visible: note.text === ""
                      text: "What does it bring up?"
                      color: Util.alpha(root.ink, 0.4)
                      font: note.font
                    }
                  }
                }
                Row {
                  spacing: Style.space(8)
                  Button {
                    text: root.journalBusy ? "Saving…" : (root.today && root.today.saved ? "Save again" : "Save to Journal")
                    foreground: root.ink
                    bordered: true
                    enabled: !root.journalBusy
                    onClicked: root.saveToJournal()
                  }
                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: root.journalStatus
                    color: root.journalStatus === "Saved to Journal" ? root.accent : Color.urgent
                    font.family: Style.font.family
                    font.pixelSize: Style.font.bodySmall
                  }
                }
              }

              PanelSeparator { foreground: root.ink }

              // where the card comes from
              Text {
                text: "Draw from"
                color: Util.alpha(root.ink, 0.6)
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
              }
              // one card a day of each; a ✓ once today's is pulled
              Flow {
                width: parent.width
                spacing: Style.space(6)
                visible: root.kinds.length > 1
                Repeater {
                  model: root.kinds
                  Button {
                    required property var modelData
                    text: root.kindNames[modelData] + (root.todayFor(modelData) ? "  ✓" : "")
                    foreground: root.ink
                    bordered: true
                    selected: root.st.kind === modelData
                    visible: (root.decks[modelData] || []).length > 0
                    onClicked: root.showKind(modelData)
                  }
                }
              }
              Flow {
                width: parent.width
                spacing: Style.space(6)
                Button {
                  text: "Any deck"
                  foreground: root.ink
                  bordered: true
                  selected: root.deckId === "any"
                  onClicked: root.chooseDeck("any")
                }
                Repeater {
                  model: root.kindDecks
                  Button {
                    required property var modelData
                    text: modelData.name
                    foreground: root.ink
                    bordered: true
                    selected: root.deckId === modelData.id
                    onClicked: root.chooseDeck(modelData.id)
                  }
                }
              }

              Row {
                spacing: Style.space(8)
                Button {
                  text: root.viewing ? "Back to today" : "Draw again"
                  foreground: root.ink
                  bordered: true
                  visible: !!root.today || !!root.viewing
                  onClicked: root.viewing ? (root.viewing = null) : root.redraw()
                }
                Button {
                  text: "Close"
                  foreground: root.ink
                  bordered: true
                  onClicked: root.close()
                }
              }

              // past pulls
              Text {
                visible: pastRow.count > 0
                text: "Past pulls"
                color: Util.alpha(root.ink, 0.6)
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
                topPadding: Style.space(6)
              }
              Flow {
                width: parent.width
                spacing: Style.space(6)
                Repeater {
                  id: pastRow
                  model: (root.st.history || []).filter(function(p) {
                    return !root.todayCards.some(function(t) { return t.at === p.at })
                  }).slice(0, 12)
                  Item {
                    required property var modelData
                    width: 54; height: 92
                    Rectangle {
                      anchors.fill: parent
                      radius: 6
                      color: "#111111"
                      border.width: root.viewing && root.viewing.at === modelData.at ? 2 : 0
                      border.color: root.accent
                      clip: true
                      Image {
                        anchors.fill: parent
                        anchors.margins: 2
                        fillMode: Image.PreserveAspectFit
                        asynchronous: true
                        sourceSize.height: 200
                        source: root.imageUrl(modelData.image)
                        rotation: modelData.reversed ? 180 : 0
                      }
                    }
                    MouseArea {
                      anchors.fill: parent
                      cursorShape: Qt.PointingHandCursor
                      onClicked: root.viewing = modelData
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
