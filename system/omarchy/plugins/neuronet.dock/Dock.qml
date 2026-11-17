import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import Quickshell.Hyprland
import qs.Commons
import qs.Ui

// NeuroNet Dock -- on every workspace, replacing Arc Dock.
//
// Cam: "create a dock that is themed around Neuronet and changes based on
// whether you are in light or dark mode ... I want to be able to pin things
// to the dock, i want settings to be able to automatically hide, i want a
// specialist hide which will hide the dock just off the screen, with a little
// icon at the bottom of the screen, which when pressed will bring up the dock
// ... The icon will only appear when i move the cursor to the bottom like how
// auto hide will work, i want the background of the dock to match the light
// or dark setting but have the ability to edit how opaque or transparent it is."
//
// THE LOOK. The apps sit along an axon -- a thin line running out of the
// neuron at the left (the launcher: all apps). A running app is a node on
// that line; the focused one fires in the signal colour. Launching sends an
// impulse down the axon to the app. Colours are the Omarchy theme's (ground,
// ink, accent), so NeuroNet dark and NeuroNet Light each get their own dock.
//
// HIDING (settings: right-click the neuron, or any app -> Dock settings):
//   never  -- always up; windows are kept clear of it (it reserves its space)
//   auto   -- slides away; touch the bottom edge to call it up
//   tuck   -- slides away; touch the bottom edge and a small neuron appears;
//             click it to call the dock up. It goes away again when you leave.
//
// PINNING. Right-click an app: pin / unpin / move. Or search for any app in
// settings and pin it from there. Pins and settings are kept in
// ~/.local/state/omarchy/neuronet-dock.json. First run takes Arc Dock's pins.
Item {
  id: root

  property var shell: null
  property var manifest: null
  readonly property var appLibrary: shell ? shell.appLibrary : null

  // ---- theme ------------------------------------------------------------------
  readonly property bool light: Color.background.hslLightness > 0.5
  readonly property color ground: Color.background
  readonly property color ink: Color.foreground
  readonly property color accent: Color.accent
  readonly property color signal: light ? "#007c8c" : "#00E5FF"   // the themes' cyan
  function alpha(c, a) { return Qt.rgba(c.r, c.g, c.b, a) }

  // ---- settings (saved) -------------------------------------------------------
  property string hideMode: "auto"        // never | auto | tuck
  property real bgOpacity: 0.85           // the dock's ground, 0..1
  property int iconSize: 44
  property var pinned: []                 // [{ key, entry }]

  readonly property int pad: Math.round(iconSize * 0.24)
  readonly property int gap: Math.round(iconSize * 0.3)
  readonly property int railSpace: 12     // under the icons: the axon and its nodes
  readonly property int bottomGap: 8      // dock to screen edge
  readonly property int headroom: 46      // above the dock: tooltips, the hover lift

  // ---- the screen -------------------------------------------------------------
  readonly property var targetScreen: {
    var screens = Quickshell.screens || []
    var best = null
    for (var i = 0; i < screens.length; i++) {
      var c = screens[i]
      if (!c || c.width <= 0 || c.height <= 0) continue
      if (!best || c.width * c.height > best.width * best.height) best = c
    }
    return best
  }

  // ---- floating workspaces (17 Nov 2026) --------------------------------------
  // Cam: "When using floating window layout please hide the neuronet dock because it wont be needed and
  // gets in the way. It should still be availible for scrolling and tiling mode." Omarchy's own dock
  // shows on floating workspaces, so this one steps aside there.
  // Hyprland reports only the tiled layout, so the mode is read the way omarchy-hyprland-workspace-
  // layout-current reads it: the workspace's own file in workspace-layouts/ (written by Super+L), and
  // without a mode of its own, the default (default.lua). Two watched files, no process and no timer:
  // the toggle writes or deletes the file, and the watch sees both. A watch needs the folder to be there
  // (it isn't until Super+L is first pressed), so the dock makes it, empty, once, and watches after that.
  property bool layoutsReady: false
  Process {
    running: true
    command: ["mkdir", "-p", root.layoutsDir]
    onExited: root.layoutsReady = true
  }
  readonly property var dockMonitor: targetScreen ? Hyprland.monitorFor(targetScreen) : null
  readonly property int dockWorkspace: dockMonitor && dockMonitor.activeWorkspace ? dockMonitor.activeWorkspace.id : -1
  readonly property string layoutsDir: (Quickshell.env("XDG_STATE_HOME") || Quickshell.env("HOME") + "/.local/state") + "/omarchy/workspace-layouts"
  property string workspaceMode: ""       // the mode the workspace's own file names ("" = none)
  property string defaultMode: ""         // the mode default.lua names ("" = none)
  readonly property bool floatingHere: dockWorkspace >= 1
      && (workspaceMode === "floating" || (workspaceMode === "" && defaultMode === "floating"))
  function modeIn(text, key) {
    var m = String(text || "").match(new RegExp(key + '\\s*=\\s*"([a-z]+)"'))
    return m ? m[1] : ""
  }
  FileView {
    path: root.layoutsReady && root.dockWorkspace >= 1 ? root.layoutsDir + "/" + root.dockWorkspace + ".lua" : ""
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.workspaceMode = root.modeIn(text(), "mode")
    onLoadFailed: root.workspaceMode = ""
    onPathChanged: if (!path) root.workspaceMode = ""
  }
  FileView {
    path: root.layoutsReady ? root.layoutsDir + "/default.lua" : ""
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.defaultMode = root.modeIn(text(), "default")
    onLoadFailed: root.defaultMode = ""
  }
  // onto a floating workspace the dock's pop-ups close with it; off one it comes back as it was
  onFloatingHereChanged: if (floatingHere) { menuOpen = false; settingsOpen = false; shown = false; peek = false }

  // ---- state file -------------------------------------------------------------
  readonly property string stateDir: Quickshell.env("HOME") + "/.local/state/omarchy"
  property bool loaded: false

  FileView {
    id: stateFile
    path: root.stateDir + "/neuronet-dock.json"
    printErrors: false
    onLoaded: {
      try {
        var d = JSON.parse(text())
        var s = d.settings || {}
        if (["never", "auto", "tuck"].indexOf(s.hideMode) >= 0) root.hideMode = s.hideMode
        if (typeof s.opacity === "number") root.bgOpacity = Math.max(0, Math.min(1, s.opacity))
        if (typeof s.iconSize === "number") root.iconSize = Math.max(28, Math.min(72, Math.round(s.iconSize)))
        root.pinned = root.cleanPins(d.pinned)
      } catch (e) { console.warn("neuronet.dock: unreadable state, starting fresh:", e) }
      root.loaded = true
      root.rebuild()
    }
    onLoadFailed: root.seed()
  }
  // Arc Dock's pins, taken once on the first run
  FileView {
    id: arcFile
    path: root.stateDir + "/arc-dock.json"
    blockLoading: true
    printErrors: false
  }
  function cleanPins(list) {
    var out = [], seen = {}
    ;(list || []).forEach(function(p) {
      var k = String((p && p.key) || "").trim().toLowerCase()
      if (!k || seen[k]) return
      seen[k] = true
      out.push({ key: k, entry: String((p && p.entry) || "") })
    })
    return out
  }
  function seed() {
    var pins = []
    try { pins = root.cleanPins(JSON.parse(arcFile.text()).pinned) } catch (e) {}
    // NeuroNet itself, first on NeuroNet's dock
    if (!pins.some(function(p) { return p.key === "neuronet" }) && DesktopEntries.heuristicLookup("NeuroNet"))
      pins.unshift({ key: "neuronet", entry: String(DesktopEntries.heuristicLookup("NeuroNet").id) })
    root.pinned = pins
    root.loaded = true
    root.save()
    root.rebuild()
  }
  function save() {
    if (!loaded) return
    stateFile.setText(JSON.stringify({
      version: 1,
      settings: { hideMode: hideMode, opacity: Math.round(bgOpacity * 100) / 100, iconSize: iconSize },
      pinned: pinned
    }, null, 2) + "\n")
  }
  Timer { id: saveLater; interval: 300; onTriggered: root.save() }
  onHideModeChanged: { saveLater.restart(); shown = false; peek = false }
  onBgOpacityChanged: saveLater.restart()
  onIconSizeChanged: saveLater.restart()

  // ---- apps: pinned first, then whatever else is running ------------------------
  property var slots: []
  property var runOrder: []
  readonly property var ignored: ["xdg-desktop-portal-gtk", "xdg-desktop-portal", "xdg-desktop-portal-hyprland", "org.quickshell"]

  function keyOf(t) {
    var id = String((t && t.appId) || "").trim().toLowerCase()
    if (id.slice(-8) === ".desktop") id = id.slice(0, -8)
    // NeuroNet's window can come up named after its script (Manthies'
    // computer, 2026-09-29): it's still NeuroNet, on NeuroNet's pinned icon
    if (id === "neuronet.py") id = "neuronet"
    return id || ("title:" + String((t && t.title) || "").trim().toLowerCase())
  }
  function entryFor(key, entryId) {
    var d = entryId ? DesktopEntries.byId(entryId) : null
    if (!d && key.indexOf("title:") !== 0) d = DesktopEntries.heuristicLookup(key)
    return d
  }
  // The entry's icon; with no entry, the app id and its last part; Omarchy's
  // own terminal windows (org.omarchy.agent ...) have no entry, so a terminal.
  function iconFor(d, key) {
    var names = []
    if (d && d.icon) names.push(String(d.icon))
    if (key) { names.push(key); names.push(key.split(".").pop()) }
    if (String(key).indexOf("org.omarchy.") === 0) names.push("utilities-terminal", "terminal")
    names.push("application-x-executable")
    for (var i = 0; i < names.length; i++) {
      var name = names[i]
      if (name.indexOf("/") === 0) return "file://" + name
      var p = Quickshell.iconPath(name, true)
      if (String(p).length) return p
    }
    return ""
  }

  function rebuild() {
    if (!loaded) return
    var tops = (ToplevelManager.toplevels && ToplevelManager.toplevels.values) || []
    var list = [], running = [], byKey = {}
    function alias(k, s) { k = String(k || "").toLowerCase(); if (k && !byKey[k]) byKey[k] = s }
    pinned.forEach(function(p) {
      var d = root.entryFor(p.key, p.entry)
      var s = { key: p.key, desktop: d, pinned: true, windows: [], name: d ? d.name : p.key, icon: root.iconFor(d, p.key) }
      list.push(s)
      alias(p.key, s)
      if (d) { alias(d.id, s); alias(String(d.id).replace(/\.desktop$/, ""), s); alias(d.startupClass, s) }
    })
    for (var i = 0; i < tops.length; i++) {
      var t = tops[i]
      var k = root.keyOf(t)
      if (root.ignored.indexOf(k) >= 0) continue
      var s = byKey[k]
      if (!s) {
        var d = root.entryFor(k, "")
        if (d) s = byKey[String(d.id).toLowerCase()]
        if (!s) {
          s = { key: k, desktop: d, pinned: false, windows: [],
                name: d ? d.name : (t.title || k), icon: root.iconFor(d, k) }
          running.push(s)
          alias(k, s)
          if (d) alias(d.id, s)
        }
      }
      s.windows.push(t)
    }
    // running apps keep the place they arrived in
    var order = runOrder.filter(function(k) { return running.some(function(s) { return s.key === k }) })
    running.forEach(function(s) { if (order.indexOf(s.key) < 0) order.push(s.key) })
    running.sort(function(a, b) { return order.indexOf(a.key) - order.indexOf(b.key) })
    runOrder = order
    slots = list.concat(running)
  }
  Timer { id: rebuildLater; interval: 40; onTriggered: root.rebuild() }
  Connections { target: ToplevelManager.toplevels; function onValuesChanged() { rebuildLater.restart() } }
  Connections { target: DesktopEntries.applications; function onValuesChanged() { rebuildLater.restart() } }
  onPinnedChanged: { rebuildLater.restart(); saveLater.restart() }

  // ---- actions ----------------------------------------------------------------
  function launch(s, item) {
    var d = s ? s.desktop : null
    if (!d) return
    if (root.appLibrary && root.appLibrary.launch && d.id) root.appLibrary.launch(String(d.id), String(d.name || d.id))
    else d.execute()
    if (item) root.fire(item)
  }
  function activate(s, item) {
    if (!s.windows.length) { root.launch(s, item); return }
    var cur = s.windows.indexOf(ToplevelManager.activeToplevel)
    root.focusWindow(s.windows[(cur + 1) % s.windows.length])
  }
  function focusWindow(t) {
    var list = (Hyprland.toplevels && Hyprland.toplevels.values) || []
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].wayland === t && list[i].address) {
        var target = "address:0x" + list[i].address
        Hyprland.dispatch(Hyprland.usingLua ? 'hl.dsp.focus({ window = "' + target + '" })' : "focuswindow " + target)
        return
      }
    }
    if (t) t.activate()
  }
  function pinIndex(key) { for (var i = 0; i < pinned.length; i++) if (pinned[i].key === key) return i; return -1 }
  function togglePin(s) {
    var i = pinIndex(s.key), next = pinned.slice()
    if (i >= 0) next.splice(i, 1)
    else next.push({ key: s.key, entry: s.desktop ? String(s.desktop.id) : "" })
    pinned = next
  }
  function pinEntry(d) {
    var key = String(d.id).toLowerCase().replace(/\.desktop$/, "")
    if (pinIndex(key) >= 0) return
    var next = pinned.slice(); next.push({ key: key, entry: String(d.id) }); pinned = next
  }
  function movePin(key, delta) {
    var i = pinIndex(key), j = i + delta
    if (i < 0 || j < 0 || j >= pinned.length) return
    var next = pinned.slice(), t = next[i]; next[i] = next[j]; next[j] = t
    pinned = next
  }
  function openApps() {
    root.closeMenu()
    if (root.shell && typeof root.shell.toggle === "function"
        && root.shell.toggle("omarchy.menu", JSON.stringify({ menu: "apps" }))) return
    Util.execDetached("omarchy-menu toggle apps")
  }

  // an impulse runs down the axon from the neuron to what was launched
  function fire(item) {
    var p = item.mapToItem(body, item.width / 2, 0)
    impulse.toX = p.x
    impulseAnim.restart()
  }

  // ---- showing and hiding -----------------------------------------------------
  property bool shown: false              // called up (auto / tuck)
  property bool peek: false               // tuck: the handle is showing
  property bool menuOpen: false
  property bool settingsOpen: false
  readonly property bool revealed: hideMode === "never" || shown || menuOpen || settingsOpen
  readonly property bool pointerIn: winHover.hovered

  onPointerInChanged: {
    if (pointerIn) {
      leave.stop()
      if (!revealed) {
        if (hideMode === "auto") shown = true
        else if (hideMode === "tuck") peek = true
      }
    } else leave.restart()
  }
  Timer {
    id: leave
    interval: root.hideMode === "tuck" ? 900 : 450
    onTriggered: if (!root.pointerIn && !root.menuOpen && !root.settingsOpen) { root.shown = false; root.peek = false }
  }
  onMenuOpenChanged: if (!menuOpen && !pointerIn) leave.restart()
  onSettingsOpenChanged: if (!settingsOpen && !pointerIn) leave.restart()

  // ---- the dock ---------------------------------------------------------------
  property Item hoveredSlot: null
  property string hoveredName: ""

  PanelWindow {
    id: win
    screen: root.targetScreen
    visible: root.loaded && !root.floatingHere
    color: "transparent"
    WlrLayershell.namespace: "neuronet.dock"
    WlrLayershell.layer: WlrLayer.Top
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
    anchors.bottom: true
    // always-up keeps windows clear of it; hidden modes float over them
    exclusionMode: root.hideMode === "never" ? ExclusionMode.Normal : ExclusionMode.Ignore
    exclusiveZone: root.hideMode === "never" ? body.height + root.bottomGap : 0
    implicitWidth: Math.max(body.width, 160) + 48
    implicitHeight: body.height + root.bottomGap + root.headroom

    // clicks land only here; everything else in the window passes through
    mask: Region { item: hit }
    readonly property real restY: height - root.bottomGap - body.height
    Item {
      id: hit
      x: body.x
      width: body.width
      y: root.revealed ? win.restY : (root.hideMode === "tuck" && root.peek ? win.height - 36 : win.height - 3)
      height: win.height - y
    }

    Item {
      anchors.fill: parent
      HoverHandler { id: winHover }

      // the tucked-away handle: a small neuron at the bottom edge
      Rectangle {
        id: handle
        width: 60; height: 22; radius: 11
        x: (parent.width - width) / 2
        y: parent.height - height - 5
        opacity: root.hideMode === "tuck" && root.peek && !root.revealed ? 1 : 0
        visible: opacity > 0
        Behavior on opacity { NumberAnimation { duration: 160 } }
        color: root.alpha(root.ground, Math.max(0.6, root.bgOpacity))
        border.width: 1
        border.color: root.alpha(root.accent, handleMa.containsMouse ? 0.9 : 0.5)
        NeuronGlyph {
          anchors.centerIn: parent
          width: 18; height: 18
          color: handleMa.containsMouse ? root.signal : root.accent
        }
        MouseArea {
          id: handleMa
          anchors.fill: parent
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onClicked: { root.shown = true; root.peek = false }
        }
      }

      // the body
      Item {
        id: body
        width: row.width + root.pad * 2
        height: root.iconSize + root.pad * 2 + root.railSpace - 4
        x: (parent.width - width) / 2
        y: win.restY + (root.revealed ? 0 : height + root.bottomGap + 8)
        Behavior on y { NumberAnimation { duration: 240; easing.type: Easing.OutCubic } }
        opacity: root.revealed ? 1 : 0
        Behavior on opacity { NumberAnimation { duration: 200 } }

        // a faint halo of accent around the glass
        Rectangle {
          anchors.fill: parent
          anchors.margins: -3
          radius: glass.radius + 3
          color: "transparent"
          border.width: 3
          border.color: root.alpha(root.accent, root.light ? 0.08 : 0.12)
        }
        Rectangle {
          id: glass
          anchors.fill: parent
          radius: Math.round(root.iconSize * 0.42)
          color: root.alpha(root.ground, root.bgOpacity)
          border.width: 1
          border.color: root.alpha(root.accent, root.light ? 0.45 : 0.38)
        }

        // the axon: out of the neuron, under every app
        readonly property real railY: root.pad + root.iconSize + 6
        Rectangle {
          x: launcher.x + row.x + launcher.width / 2
          width: Math.max(0, row.x + row.width - root.iconSize / 2 - x)
          y: body.railY
          height: 1.5
          radius: 1
          gradient: Gradient {
            orientation: Gradient.Horizontal
            GradientStop { position: 0; color: root.alpha(root.accent, 0.75) }
            GradientStop { position: 1; color: root.alpha(root.accent, 0.18) }
          }
        }
        // the impulse
        Rectangle {
          id: impulse
          property real toX: 0
          width: 10; height: 10; radius: 5
          y: body.railY + 0.75 - height / 2
          color: root.signal
          opacity: 0
          Rectangle { anchors.centerIn: parent; width: 22; height: 22; radius: 11; color: root.alpha(root.signal, 0.25) }
        }
        SequentialAnimation {
          id: impulseAnim
          ScriptAction { script: { impulse.x = launcher.x + row.x + launcher.width / 2 - 5; impulse.opacity = 1 } }
          NumberAnimation { target: impulse; property: "x"; to: impulse.toX - 5; duration: 420; easing.type: Easing.InOutQuad }
          NumberAnimation { target: impulse; property: "opacity"; to: 0; duration: 380 }
        }

        Row {
          id: row
          x: root.pad
          y: root.pad
          spacing: root.gap

          // the neuron: all apps (right-click: dock settings)
          Item {
            id: launcher
            width: root.iconSize; height: root.iconSize
            NeuronGlyph {
              anchors.centerIn: parent
              width: parent.width * 0.86; height: width
              color: launchMa.containsMouse ? root.signal : root.accent
              scale: launchMa.containsMouse ? 1.08 : 1
              Behavior on scale { NumberAnimation { duration: 140 } }
            }
            MouseArea {
              id: launchMa
              anchors.fill: parent
              hoverEnabled: true
              acceptedButtons: Qt.LeftButton | Qt.RightButton
              cursorShape: Qt.PointingHandCursor
              onContainsMouseChanged: {
                if (containsMouse) { root.hoveredSlot = launcher; root.hoveredName = "All apps" }
                else if (root.hoveredSlot === launcher) root.hoveredSlot = null
              }
              onClicked: function(m) { if (m.button === Qt.RightButton) root.openSettings(); else root.openApps() }
            }
          }

          Repeater {
            model: root.slots
            delegate: Item {
              id: slot
              required property var modelData
              readonly property bool running: modelData.windows.length > 0
              readonly property bool active: running && modelData.windows.indexOf(ToplevelManager.activeToplevel) >= 0
              width: root.iconSize; height: root.iconSize

              Image {
                id: icon
                anchors.centerIn: parent
                width: root.iconSize; height: root.iconSize
                sourceSize: Qt.size(root.iconSize * 2, root.iconSize * 2)
                source: slot.modelData.icon
                smooth: true
                mipmap: true
                asynchronous: true
                opacity: slot.running || ma.containsMouse ? 1 : 0.82
                scale: ma.pressed ? 0.94 : ma.containsMouse ? 1.1 : 1
                transform: Translate { y: ma.containsMouse ? -4 : 0; Behavior on y { NumberAnimation { duration: 140 } } }
                Behavior on scale { NumberAnimation { duration: 140 } }
              }
              // no icon: its initial, in a ring
              Rectangle {
                visible: icon.status !== Image.Ready
                anchors.centerIn: parent
                width: root.iconSize * 0.86; height: width; radius: width / 2
                color: "transparent"
                border.width: 1.5
                border.color: root.accent
                Text {
                  anchors.centerIn: parent
                  text: String(slot.modelData.name || "?").charAt(0).toUpperCase()
                  color: root.ink
                  font.family: Style.font.family
                  font.pixelSize: root.iconSize * 0.4
                  font.bold: true
                }
              }

              // its synapse on the axon: one node per window (up to three)
              Row {
                anchors.horizontalCenter: parent.horizontalCenter
                y: body.railY - root.pad - height / 2 + 0.75
                spacing: 4
                Repeater {
                  model: Math.min(3, slot.modelData.windows.length)
                  delegate: Rectangle {
                    width: slot.active ? 8 : 6; height: width; radius: width / 2
                    color: slot.active ? root.signal : root.accent
                    Rectangle {
                      visible: slot.active
                      anchors.centerIn: parent
                      width: 18; height: 18; radius: 9
                      color: root.alpha(root.signal, 0.22)
                    }
                  }
                }
              }
              // pinned but not running: a faint mark where its node would be
              Rectangle {
                visible: !slot.running
                anchors.horizontalCenter: parent.horizontalCenter
                y: body.railY - root.pad - height / 2 + 0.75
                width: 3; height: 3; radius: 1.5
                color: root.alpha(root.ink, 0.35)
              }

              MouseArea {
                id: ma
                anchors.fill: parent
                hoverEnabled: true
                acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton
                cursorShape: Qt.PointingHandCursor
                onContainsMouseChanged: {
                  if (containsMouse) { root.hoveredSlot = slot; root.hoveredName = slot.modelData.name }
                  else if (root.hoveredSlot === slot) root.hoveredSlot = null
                }
                onClicked: function(m) {
                  if (m.button === Qt.RightButton) root.openMenu(slot.modelData, slot)
                  else if (m.button === Qt.MiddleButton) root.launch(slot.modelData, slot)
                  else root.activate(slot.modelData, slot)
                }
              }
            }
          }
        }
      }

      // the name of what's under the pointer
      Rectangle {
        id: tip
        readonly property var at: root.hoveredSlot ? root.hoveredSlot.mapToItem(parent, root.hoveredSlot.width / 2, 0) : null
        visible: opacity > 0
        opacity: at && root.revealed && !root.menuOpen && !root.settingsOpen ? 1 : 0
        Behavior on opacity { NumberAnimation { duration: 120 } }
        width: Math.min(tipText.implicitWidth + 20, parent.width - 8)
        height: tipText.implicitHeight + 10
        radius: height / 2
        x: at ? Math.max(4, Math.min(parent.width - width - 4, at.x - width / 2)) : 0
        y: at ? at.y - height - 12 : 0
        color: root.alpha(root.ground, 0.96)
        border.width: 1
        border.color: root.alpha(root.accent, 0.5)
        Text {
          id: tipText
          anchors.centerIn: parent
          width: parent.width - 20
          horizontalAlignment: Text.AlignHCenter
          elide: Text.ElideRight
          text: root.hoveredName
          color: root.ink
          font.family: Style.font.family
          font.pixelSize: Style.font.body
        }
      }
    }
  }

  // where on the screen something in the dock is (the dock window is centred)
  function screenX(item) {
    var p = item.mapToItem(win.contentItem, item.width / 2, 0)
    var W = root.targetScreen ? root.targetScreen.width : win.width
    return (W - win.width) / 2 + p.x
  }

  // ---- the right-click menu ---------------------------------------------------
  property var menuFor: null
  property real menuX: 0
  function openMenu(s, item) {
    settingsOpen = false
    menuFor = s
    menuX = screenX(item)
    menuOpen = true
  }
  function closeMenu() { menuOpen = false }

  readonly property var menuItems: {
    var s = menuFor
    if (!s) return []
    var out = []
    if (s.desktop) out.push({ label: s.windows.length ? "New window" : "Open", run: function() { root.launch(s, null) } })
    out.push({ label: s.pinned ? "Unpin from dock" : "Pin to dock", run: function() { root.togglePin(s) } })
    var i = root.pinIndex(s.key)
    if (i > 0) out.push({ label: "Move left", run: function() { root.movePin(s.key, -1) } })
    if (i >= 0 && i < root.pinned.length - 1) out.push({ label: "Move right", run: function() { root.movePin(s.key, 1) } })
    if (s.windows.length === 1) out.push({ label: "Close", run: function() { s.windows[0].close() } })
    if (s.windows.length > 1) out.push({ label: "Close all " + s.windows.length, run: function() { s.windows.forEach(function(w) { w.close() }) } })
    out.push({ label: "", run: null })
    out.push({ label: "Dock settings…", run: function() { root.openSettings() } })
    return out
  }

  PanelWindow {
    id: menuWin
    screen: root.targetScreen
    visible: root.menuOpen
    color: "transparent"
    WlrLayershell.namespace: "neuronet.dock-menu"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.OnDemand
    exclusionMode: ExclusionMode.Ignore
    anchors { bottom: true; left: true }
    margins {
      left: Math.round(Math.max(8, root.menuX - implicitWidth / 2))
      bottom: body.height + root.bottomGap + 10
    }
    implicitWidth: 220
    implicitHeight: menuCol.implicitHeight + 16

    HyprlandFocusGrab {
      windows: [menuWin]
      active: menuWin.visible
      onCleared: root.closeMenu()
    }

    Rectangle {
      anchors.fill: parent
      radius: 14
      color: root.alpha(root.ground, 0.97)
      border.width: 1
      border.color: root.alpha(root.accent, 0.55)
      focus: true
      Keys.onEscapePressed: root.closeMenu()

      Column {
        id: menuCol
        x: 8; y: 8
        width: parent.width - 16
        Text {
          width: parent.width
          leftPadding: 10; topPadding: 4; bottomPadding: 6
          text: root.menuFor ? root.menuFor.name : ""
          elide: Text.ElideRight
          color: root.accent
          font.family: Style.font.family
          font.pixelSize: Style.font.body
          font.bold: true
        }
        Repeater {
          model: root.menuItems
          delegate: Item {
            required property var modelData
            width: menuCol.width
            height: modelData.run ? 30 : 9
            Rectangle {
              visible: !parent.modelData.run
              anchors.centerIn: parent
              width: parent.width - 16; height: 1
              color: root.alpha(root.ink, 0.15)
            }
            Rectangle {
              visible: !!parent.modelData.run
              anchors.fill: parent
              radius: 8
              color: rowMa.containsMouse ? root.alpha(root.accent, root.light ? 0.16 : 0.2) : "transparent"
              Text {
                anchors.verticalCenter: parent.verticalCenter
                x: 10
                text: parent.parent.modelData.label
                color: rowMa.containsMouse ? (root.light ? root.ink : root.signal) : root.ink
                font.family: Style.font.family
                font.pixelSize: Style.font.body
              }
              MouseArea {
                id: rowMa
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: { var f = parent.parent.modelData.run; root.closeMenu(); if (f) f() }
              }
            }
          }
        }
      }
    }
  }

  // ---- settings ---------------------------------------------------------------
  function openSettings() {
    menuOpen = false
    search.text = ""
    settingsOpen = true
  }

  readonly property var searchResults: {
    var q = search.text.trim().toLowerCase()
    if (!q) return []
    var apps = (DesktopEntries.applications && DesktopEntries.applications.values) || []
    var out = []
    for (var i = 0; i < apps.length && out.length < 6; i++) {
      var a = apps[i]
      if (!a || a.noDisplay) continue
      if (String(a.name).toLowerCase().indexOf(q) < 0) continue
      if (root.pinIndex(String(a.id).toLowerCase().replace(/\.desktop$/, "")) >= 0) continue
      out.push(a)
    }
    return out
  }

  component Label: Text {
    color: root.alpha(root.ink, 0.6)
    font.family: Style.font.family
    font.pixelSize: Style.font.caption
    font.bold: true
    font.capitalization: Font.AllUppercase
    font.letterSpacing: 1
  }

  PanelWindow {
    id: setWin
    screen: root.targetScreen
    visible: root.settingsOpen
    color: "transparent"
    WlrLayershell.namespace: "neuronet.dock-settings"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.OnDemand
    exclusionMode: ExclusionMode.Ignore
    anchors.bottom: true
    margins.bottom: body.height + root.bottomGap + 12
    implicitWidth: 380
    implicitHeight: setCol.implicitHeight + 36

    HyprlandFocusGrab {
      windows: [setWin]
      active: setWin.visible
      onCleared: root.settingsOpen = false
    }

    Rectangle {
      anchors.fill: parent
      radius: 18
      color: root.alpha(root.ground, 0.97)
      border.width: 1
      border.color: root.alpha(root.accent, 0.55)
      Keys.onEscapePressed: root.settingsOpen = false

      Column {
        id: setCol
        x: 18; y: 18
        width: parent.width - 36
        spacing: 14

        Row {
          spacing: 10
          NeuronGlyph { width: 26; height: 26; color: root.accent; anchors.verticalCenter: parent.verticalCenter }
          Text {
            anchors.verticalCenter: parent.verticalCenter
            text: "NeuroNet Dock"
            color: root.ink
            font.family: Style.font.family
            font.pixelSize: Style.font.title
            font.bold: true
          }
        }

        // hiding
        Column {
          width: parent.width
          spacing: 6
          Label { text: "Hiding" }
          Row {
            spacing: 6
            Repeater {
              model: [["never", "Always show"], ["auto", "Auto-hide"], ["tuck", "Tuck away"]]
              delegate: Button {
                required property var modelData
                text: modelData[1]
                foreground: root.ink
                accent: root.accent
                bordered: true
                selected: root.hideMode === modelData[0]
                onClicked: root.hideMode = modelData[0]
              }
            }
          }
          Text {
            width: parent.width
            wrapMode: Text.WordWrap
            color: root.alpha(root.ink, 0.65)
            font.family: Style.font.family
            font.pixelSize: Style.font.caption
            text: root.hideMode === "never" ? "Always up. Windows keep clear of it."
                : root.hideMode === "auto" ? "Slides away. Touch the bottom edge to bring it up."
                : "Slides away. Touch the bottom edge and a small neuron appears. Click it to bring the dock up."
          }
        }

        // background
        Column {
          width: parent.width
          spacing: 4
          Item {
            width: parent.width; height: opLabel.height
            Label { id: opLabel; text: "Background" }
            Text {
              anchors.right: parent.right
              text: Math.round(opSlider.liveValue * 100) + "%"
              color: root.ink
              font.family: Style.font.family
              font.pixelSize: Style.font.caption
            }
          }
          PanelSlider {
            id: opSlider
            width: parent.width
            minimum: 0; maximum: 1; step: 0.05
            value: root.bgOpacity
            trackColor: root.alpha(root.ink, 0.15)
            fillColor: root.accent
            knobColor: root.accent
            onMoved: function(v) { root.bgOpacity = v }
            onReleased: function(v) { root.bgOpacity = v }
          }
        }

        // size
        Column {
          width: parent.width
          spacing: 4
          Item {
            width: parent.width; height: szLabel.height
            Label { id: szLabel; text: "Icon size" }
            Text {
              anchors.right: parent.right
              text: Math.round(szSlider.liveValue) + " px"
              color: root.ink
              font.family: Style.font.family
              font.pixelSize: Style.font.caption
            }
          }
          PanelSlider {
            id: szSlider
            width: parent.width
            minimum: 32; maximum: 64; step: 2; integer: true
            value: root.iconSize
            trackColor: root.alpha(root.ink, 0.15)
            fillColor: root.accent
            knobColor: root.accent
            onReleased: function(v) { root.iconSize = Math.round(v) }
          }
        }

        // pinned
        Column {
          width: parent.width
          spacing: 4
          Label { text: "Pinned" }
          Text {
            visible: root.pinned.length === 0
            text: "Nothing pinned yet."
            color: root.alpha(root.ink, 0.6)
            font.family: Style.font.family
            font.pixelSize: Style.font.body
          }
          Repeater {
            model: root.slots.filter(function(s) { return s.pinned })
            delegate: Item {
              required property var modelData
              required property int index
              width: parent.width; height: 30
              Image {
                id: pinIcon
                width: 20; height: 20
                anchors.verticalCenter: parent.verticalCenter
                sourceSize: Qt.size(40, 40)
                source: parent.modelData.icon
                smooth: true
              }
              Text {
                anchors.left: pinIcon.right; anchors.leftMargin: 10
                anchors.right: pinBtns.left; anchors.rightMargin: 6
                anchors.verticalCenter: parent.verticalCenter
                text: parent.modelData.name
                elide: Text.ElideRight
                color: root.ink
                font.family: Style.font.family
                font.pixelSize: Style.font.body
              }
              Row {
                id: pinBtns
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                spacing: 2
                Button { text: "◀"; foreground: root.ink; enabled: index > 0; opacity: enabled ? 1 : 0.3
                         onClicked: root.movePin(parent.parent.modelData.key, -1) }
                Button { text: "▶"; foreground: root.ink; enabled: index < root.pinned.length - 1; opacity: enabled ? 1 : 0.3
                         onClicked: root.movePin(parent.parent.modelData.key, 1) }
                Button { text: "✕"; foreground: root.ink
                         onClicked: root.togglePin(parent.parent.modelData) }
              }
            }
          }
        }

        // pin an app
        Column {
          width: parent.width
          spacing: 6
          Label { text: "Pin an app" }
          Rectangle {
            width: parent.width; height: 34
            radius: 10
            color: root.alpha(root.ink, 0.05)
            border.width: 1
            border.color: search.activeFocus ? root.accent : root.alpha(root.ink, 0.2)
            TextInput {
              id: search
              anchors.fill: parent
              anchors.leftMargin: 12; anchors.rightMargin: 12
              verticalAlignment: TextInput.AlignVCenter
              color: root.ink
              selectionColor: root.alpha(root.accent, 0.4)
              font.family: Style.font.family
              font.pixelSize: Style.font.body
              clip: true
              Keys.onEscapePressed: root.settingsOpen = false
              Keys.onReturnPressed: if (root.searchResults.length) { root.pinEntry(root.searchResults[0]); text = "" }
              Text {
                visible: !search.text && !search.activeFocus
                anchors.verticalCenter: parent.verticalCenter
                text: "Search apps…"
                color: root.alpha(root.ink, 0.45)
                font: search.font
              }
            }
            MouseArea { anchors.fill: parent; onPressed: function(m) { search.forceActiveFocus(); m.accepted = false } }
          }
          Repeater {
            model: root.searchResults
            delegate: Rectangle {
              required property var modelData
              width: parent.width; height: 30
              radius: 8
              color: resMa.containsMouse ? root.alpha(root.accent, root.light ? 0.16 : 0.2) : "transparent"
              Image {
                id: resIcon
                x: 8; width: 20; height: 20
                anchors.verticalCenter: parent.verticalCenter
                sourceSize: Qt.size(40, 40)
                source: root.iconFor(parent.modelData, "")
              }
              Text {
                anchors.left: resIcon.right; anchors.leftMargin: 10
                anchors.right: plus.left
                anchors.verticalCenter: parent.verticalCenter
                text: parent.modelData.name
                elide: Text.ElideRight
                color: root.ink
                font.family: Style.font.family
                font.pixelSize: Style.font.body
              }
              Text {
                id: plus
                anchors.right: parent.right; anchors.rightMargin: 10
                anchors.verticalCenter: parent.verticalCenter
                text: "Pin"
                color: root.accent
                font.family: Style.font.family
                font.pixelSize: Style.font.body
                font.bold: true
              }
              MouseArea {
                id: resMa
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: root.pinEntry(parent.modelData)
              }
            }
          }
        }

        Item {
          width: parent.width; height: doneBtn.implicitHeight
          Button {
            id: doneBtn
            anchors.right: parent.right
            text: "Done"
            foreground: root.ink
            accent: root.accent
            bordered: true
            onClicked: root.settingsOpen = false
          }
        }
      }
    }
  }

  // From a terminal or a keybinding:
  //   qs -p /usr/share/omarchy/shell ipc call neuronet.dock settings
  //   ... call neuronet.dock toggle      (call it up / send it away)
  IpcHandler {
    target: "neuronet.dock"
    function settings(): void { root.shown = true; root.openSettings() }
    function toggle(): void { root.shown = !root.revealed; root.peek = false }
    function menu(index: int): void {
      var s = root.slots[index]
      if (!s) return
      root.shown = true
      root.menuFor = s
      root.menuX = (root.targetScreen ? root.targetScreen.width : 0) / 2
      root.menuOpen = true
    }
    function close(): void { root.menuOpen = false; root.settingsOpen = false }
  }

  Component.onCompleted: rebuildLater.restart()
}
