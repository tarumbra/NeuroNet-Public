import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Services.Mpris
import qs.Ui
import qs.Commons

// NeuroStream Music -- NeuroStream's player in the top bar (19 Nov 2026, V31: music moved out of NeuroNet
// into NeuroStream, NeuroTV renamed; this widget follows it).
//
// NeuroStream puts itself on the media bus as org.mpris.MediaPlayer2.neurostream. This widget follows THAT
// player only, so another app playing a video never takes it over, and it reads NeuroStream's library file
// (~/.local/share/neurostream/music/library.json, the same shape NeuroNet's chords.json had) for the album
// and playlist picker. It holds no player of its own: picking an album asks NeuroStream to play it (OpenUri
// neurostream:album/<id>), so the queue, play counts, shuffle and repeat stay NeuroStream's. If NeuroStream
// is closed, picking something opens it and plays once it is up. ♥ and "add to a playlist" call
// NeuroStream's org.neurostream.Music methods on the same bus name.
//
// Bar: left or right click opens the card, middle click plays/pauses, scrolling skips tracks.
//
// Settings (in the bar layout entry):
//   "library": path to library.json, if NeuroStream's data lives elsewhere.
BarWidget {
  id: root
  moduleName: "neuronet.music"

  readonly property string busName: "org.mpris.MediaPlayer2.neurostream"
  readonly property string libraryPath: (settings && settings.library)
    || ((Quickshell.env("XDG_DATA_HOME") || (Quickshell.env("HOME") + "/.local/share")) + "/neurostream/music/library.json")
  readonly property string imagesDir: libraryPath.substring(0, libraryPath.lastIndexOf("/")) + "/art/"
  function callApp(method, args) {
    Quickshell.execDetached(["gdbus", "call", "--session", "--dest", busName, "--object-path", "/org/mpris/MediaPlayer2",
                             "--method", "org.neurostream.Music." + method].concat(args))
  }

  readonly property var player: {
    var list = Mpris.players ? Mpris.players.values : []
    for (var i = 0; i < list.length; i++)
      if (list[i] && list[i].dbusName === busName) return list[i]
    return null
  }
  readonly property bool running: player !== null
  readonly property bool hasTrack: running && (player.trackTitle || "") !== ""
  readonly property bool playing: running && player.isPlaying
  readonly property string title: hasTrack ? player.trackTitle : ""
  // a new track: its title scrolls through once (the label below)
  property bool scrollOnce: false
  onTitleChanged: scrollOnce = title !== ""
  readonly property string artist: hasTrack ? (player.trackArtist || "") : ""

  property bool popupOpen: false
  property string tab: "Albums"
  property string pendingUri: ""        // asked for while NeuroStream was closed
  property real maxLabelWidth: 180
  property var library: ({ albums: [], playlists: [] })

  function close() { popupOpen = false; addOpen = false }

  // ♥ and "add to a playlist" (2026-10-02). Cam: "for the music player widget,
  // top bar and in general have the ability to favourite a song and also one
  // to add to a playlist which i select from a menu that comes up ... not
  // intrusive". NeuroStream does it (org.neurostream.Music.Favourite /
  // AddToPlaylist -- Music's own favourites and playlists); the ♥ shows
  // what the media bus says (xesam:userRating, from NeuroStream).
  readonly property bool favourite: hasTrack && Number((player.metadata || {})["xesam:userRating"] || 0) > 0.5
  property bool addOpen: false
  property string note: ""
  Timer { id: noteClear; interval: 2500; onTriggered: root.note = "" }
  function toggleFavourite() {
    if (!hasTrack) return
    callApp("Favourite", [favourite ? "false" : "true"])
    note = favourite ? "Taken out of favourites" : "♥ Added to favourites"
    noteClear.restart()
  }
  function addTo(pl) {
    addOpen = false
    callApp("AddToPlaylist", [String(pl.id)])
    note = "Added to “" + pl.name + "”"
    noteClear.restart()
  }

  // ---- the library file --------------------------------------------
  FileView {
    id: libraryFile
    path: root.libraryPath
    watchChanges: true
    onFileChanged: reload()
    onLoaded: root.readLibrary()
  }

  function readLibrary() {
    try {
      var d = JSON.parse(libraryFile.text())
      var byName = function(a, b) { return String(a.name || "").localeCompare(String(b.name || "")) }
      library = {
        albums: (d.albums || []).filter(function(a) { return (a.files || []).length > 0 }).sort(byName),
        playlists: (d.playlists || []).filter(function(p) { return (p.files || []).length > 0 }).sort(byName)
      }
    } catch (e) {
      // NeuroStream writes this file whole; a read mid-write just waits for
      // the next change.
    }
  }

  // ---- playing things -----------------------------------------------
  function playCollection(kind, id) {
    var uri = "neurostream:" + kind + "/" + encodeURIComponent(id)
    if (running) {
      player.openUri(uri)
      return
    }
    pendingUri = uri
    // started hidden, just to play: the music plays, the desktop stays as it
    // was (Cam, 2026-10-02: things that should close shouldn't open a tool).
    root.bar.run("neurostream")
  }

  onPlayerChanged: {
    if (player && pendingUri !== "") {
      // NeuroStream takes commands as soon as it is on the bus, so it is safe
      // to ask straight away.
      player.openUri(pendingUri)
      pendingUri = ""
    }
  }

  function openApp() {
    if (running && player.canRaise) player.raise()
    else root.bar.run("neurostream")
    popupOpen = false
  }

  function fmt(sec) {
    if (!sec || !isFinite(sec) || sec < 0) return "0:00"
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60)
    return m + ":" + (s < 10 ? "0" : "") + s
  }

  // The bus reports position on changes, not every tick; ask each second
  // while the card is showing it.
  Timer {
    interval: 1000
    repeat: true
    running: root.popupOpen && root.playing
    onTriggered: if (root.player) root.player.positionChanged()
  }

  // ---- the bar ------------------------------------------------------
  implicitWidth: row.implicitWidth + Style.space(14)
  implicitHeight: barSize

  Row {
    id: row
    anchors.centerIn: parent
    spacing: Style.space(6)

    Text {
      id: glyph
      textFormat: Text.PlainText
      anchors.verticalCenter: parent.verticalCenter
      text: root.playing ? "󰝚" : (root.hasTrack ? "󰏤" : "󰝚")
      color: root.playing ? root.bar.barForeground : Qt.darker(root.bar.barForeground, root.running ? 1.5 : 2.2)
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body
      Behavior on color {
        enabled: !root.bar || root.bar.foregroundAnimationEnabled
        ColorAnimation { duration: 160 }
      }
    }

    Item {
      id: scrollClip
      width: Math.min(root.maxLabelWidth, labelText.implicitWidth)
      height: glyph.height
      clip: true
      anchors.verticalCenter: parent.verticalCenter
      visible: !root.bar.vertical && root.title !== ""

      Text {
        id: labelText
        textFormat: Text.PlainText
        text: root.title + (root.artist ? "  ·  " + root.artist : "")
        color: root.bar.barForeground
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.body
        anchors.verticalCenter: parent.verticalCenter

        property bool needsScroll: implicitWidth > scrollClip.width

        // Scrolls once through when the track changes, and while the mouse is
        // over it -- not all the time: a title always moving redraws the bar
        // sixty times a second for as long as music plays (health check,
        // 2026-09-30). Standing still, it shows the start of the title.
        NumberAnimation on x {
          id: scroller
          running: labelText.needsScroll && !root.popupOpen && !root.bar.vertical
                   && (barMouse.containsMouse || root.scrollOnce)
          onRunningChanged: if (!running) labelText.x = 0
          onFinished: root.scrollOnce = false
          loops: barMouse.containsMouse ? Animation.Infinite : 1
          duration: Math.max(6000, labelText.implicitWidth * 25)
          from: scrollClip.width
          to: -labelText.implicitWidth
          easing.type: Easing.Linear
        }
      }
    }
  }

  MouseArea {
    id: barMouse
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton

    onClicked: function(mouse) {
      if (mouse.button === Qt.MiddleButton) {
        if (root.running) root.player.togglePlaying()
      } else {
        root.popupOpen = !root.popupOpen
      }
    }
    onWheel: function(wheel) {
      if (!root.running) return
      if (wheel.angleDelta.y > 0) root.player.previous()
      else if (wheel.angleDelta.y < 0) root.player.next()
    }
    onEntered: if (root.bar) root.bar.showTooltip(root, !root.running ? "NeuroStream Music: NeuroStream is closed"
      : root.hasTrack ? root.title + (root.artist ? " — " + root.artist : "") : "NeuroStream Music")
    onExited: if (root.bar) root.bar.hideTooltip(root)
  }

  // ---- the card -----------------------------------------------------
  PopupCard {
    id: popup
    anchorItem: root
    bar: root.bar
    owner: root
    open: root.popupOpen
    contentWidth: popup.fittedContentWidth(Style.space(340))
    contentHeight: popup.fittedContentHeight(column.implicitHeight)

    Column {
      id: column
      anchors.fill: parent
      spacing: Style.space(10)

      // now playing
      Row {
        spacing: Style.space(10)
        width: parent.width

        BorderSurface {
          width: Style.space(64)
          height: Style.space(64)
          radius: Style.spacing.labelGap
          color: Style.normalFillFor(root.bar.foreground, Color.accent)
          borderSpec: Border.controlSpec("normal", root.bar.foreground, Color.accent)

          Image {
            id: nowArt
            anchors.fill: parent
            // decoded no bigger than it's shown (twice over, for sharpness)
            sourceSize.width: 256
            sourceSize.height: 256
            anchors.margins: Style.space(2)
            fillMode: Image.PreserveAspectCrop
            asynchronous: true
            source: root.hasTrack && root.player.trackArtUrl ? root.player.trackArtUrl : ""
            visible: status === Image.Ready
          }

          Text {
            anchors.centerIn: parent
            visible: !nowArt.visible
            text: "󰝚"
            color: root.bar.foreground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.displayLarge
          }
        }

        Column {
          spacing: Style.space(4)
          width: parent.width - Style.space(74)
          anchors.verticalCenter: parent.verticalCenter

          Text {
            textFormat: Text.PlainText
            text: root.hasTrack ? root.title : (root.running ? "Nothing playing" : "NeuroStream is closed")
            color: root.bar.foreground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.subtitle
            font.bold: true
            elide: Text.ElideRight
            width: parent.width
          }

          Text {
            textFormat: Text.PlainText
            text: root.hasTrack ? root.artist
              : (root.running ? "Pick an album or playlist below" : "Pick an album to open it")
            color: Qt.darker(root.bar.foreground, 1.3)
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.bodySmall
            elide: Text.ElideRight
            width: parent.width
            visible: text !== ""
          }

          Text {
            textFormat: Text.PlainText
            text: root.hasTrack && root.player.trackAlbum ? root.player.trackAlbum : ""
            color: Qt.darker(root.bar.foreground, 1.6)
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.caption
            elide: Text.ElideRight
            width: parent.width
            visible: text !== ""
          }
        }
      }

      // progress, click to seek
      Column {
        width: parent.width
        spacing: Style.space(3)
        visible: root.hasTrack && root.player.length > 0

        Item {
          width: parent.width
          height: Style.space(12)

          Rectangle {
            anchors.verticalCenter: parent.verticalCenter
            width: parent.width
            height: Style.space(4)
            radius: height / 2
            color: Style.selectedFillFor(root.bar.foreground, Color.accent)

            Rectangle {
              width: root.hasTrack && root.player.length > 0
                ? parent.width * Math.min(1, root.player.position / root.player.length) : 0
              height: parent.height
              radius: parent.radius
              color: root.bar.foreground
            }
          }

          MouseArea {
            anchors.fill: parent
            cursorShape: root.hasTrack && root.player.canSeek ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: function(mouse) {
              if (root.hasTrack && root.player.canSeek && root.player.length > 0)
                root.player.position = root.player.length * Math.max(0, Math.min(1, mouse.x / width))
            }
          }
        }

        Item {
          width: parent.width
          height: elapsed.implicitHeight

          Text {
            id: elapsed
            text: root.hasTrack ? root.fmt(root.player.position) : ""
            color: Qt.darker(root.bar.foreground, 1.5)
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.caption
          }
          Text {
            anchors.right: parent.right
            text: root.hasTrack ? root.fmt(root.player.length) : ""
            color: Qt.darker(root.bar.foreground, 1.5)
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.caption
          }
        }
      }

      // controls
      Row {
        anchors.horizontalCenter: parent.horizontalCenter
        spacing: Style.space(6)
        visible: root.running

        Button {
          iconText: "󰒟"
          tooltipText: "Shuffle"
          foreground: root.bar.foreground
          selected: root.running && root.player.shuffle
          onClicked: if (root.running) root.player.shuffle = !root.player.shuffle
        }
        Button {
          iconText: "󰒮"
          tooltipText: "Previous"
          foreground: root.bar.foreground
          onClicked: if (root.running) root.player.previous()
        }
        Button {
          iconText: root.playing ? "󰏤" : "󰐊"
          foreground: root.bar.foreground
          horizontalPadding: Style.spacing.panelGap
          iconSize: Style.font.iconLarge
          onClicked: if (root.running) root.player.togglePlaying()
        }
        Button {
          iconText: "󰒭"
          tooltipText: "Next"
          foreground: root.bar.foreground
          onClicked: if (root.running) root.player.next()
        }
        Button {
          text: root.favourite ? "♥" : "♡"
          tooltipText: root.favourite ? "Take out of favourites" : "Favourite this song"
          foreground: root.favourite ? "#ff4f6d" : root.bar.foreground
          enabled: root.hasTrack
          onClicked: root.toggleFavourite()
        }
        Button {
          text: "+"
          tooltipText: "Add to a playlist"
          foreground: root.bar.foreground
          selected: root.addOpen
          enabled: root.hasTrack
          onClicked: root.addOpen = !root.addOpen
        }
        Button {
          iconText: root.running && root.player.loopState === MprisLoopState.Track ? "󰑘" : "󰑖"
          tooltipText: !root.running ? "Repeat"
            : root.player.loopState === MprisLoopState.Track ? "Repeat: this song"
            : root.player.loopState === MprisLoopState.Playlist ? "Repeat: all" : "Repeat: off"
          foreground: root.bar.foreground
          selected: root.running && root.player.loopState !== MprisLoopState.None
          onClicked: {
            if (!root.running) return
            var s = root.player.loopState
            root.player.loopState = s === MprisLoopState.None ? MprisLoopState.Playlist
              : s === MprisLoopState.Playlist ? MprisLoopState.Track : MprisLoopState.None
          }
        }
      }

      // the playlists to add the song to -- only while + is pressed
      Column {
        width: parent.width
        visible: root.addOpen
        spacing: 1
        Text { text: "Add “" + root.title + "” to"; width: parent.width; elide: Text.ElideRight
               color: Util.alpha(root.bar.foreground, 0.6); font.family: Style.font.family; font.pixelSize: Style.font.caption }
        Repeater {
          model: root.addOpen ? root.library.playlists : []
          Rectangle {
            required property var modelData
            width: parent.width; height: Style.space(30); radius: Style.space(6)
            color: plMouse.containsMouse ? Util.alpha(root.bar.foreground, 0.1) : "transparent"
            Text { x: Style.space(8); anchors.verticalCenter: parent.verticalCenter; width: parent.width - Style.space(16)
                   text: modelData.name; elide: Text.ElideRight; color: root.bar.foreground
                   font.family: Style.font.family; font.pixelSize: Style.font.bodySmall }
            MouseArea { id: plMouse; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor
                        onClicked: root.addTo(parent.modelData) }
          }
        }
        Text { visible: root.library.playlists.length === 0; text: "No playlists yet: make one in NeuroStream"
               color: Util.alpha(root.bar.foreground, 0.6); font.family: Style.font.family; font.pixelSize: Style.font.caption }
      }
      Text {
        visible: root.note !== ""
        anchors.horizontalCenter: parent.horizontalCenter
        text: root.note
        color: Color.accent; font.family: Style.font.family; font.pixelSize: Style.font.caption
      }

      PanelSeparator { foreground: root.bar.foreground }

      // albums / playlists
      Item {
        width: parent.width
        height: tabs.implicitHeight

        ButtonGroup {
          id: tabs
          options: ["Albums", "Playlists"]
          value: root.tab
          foreground: root.bar.foreground
          focusable: false
          onChanged: function(v) { root.tab = v }
        }

        Button {
          anchors.right: parent.right
          anchors.verticalCenter: tabs.verticalCenter
          text: root.running ? "Show NeuroStream" : "Open NeuroStream"
          foreground: root.bar.foreground
          fontSize: Style.font.bodySmall
          onClicked: root.openApp()
        }
      }

      ListView {
        id: list
        width: parent.width
        readonly property real rowHeight: Style.space(44)
        height: Math.min(Math.max(count, 1) * rowHeight, rowHeight * 6)
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        model: root.tab === "Albums" ? root.library.albums : root.library.playlists

        Text {
          anchors.centerIn: parent
          visible: list.count === 0
          text: root.tab === "Albums" ? "No albums in NeuroStream yet" : "No playlists in NeuroStream yet"
          color: Qt.darker(root.bar.foreground, 1.5)
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.bodySmall
        }

        delegate: BorderSurface {
          id: rowItem
          required property var modelData
          readonly property bool hot: rowMouse.containsMouse
          readonly property bool isPending: root.pendingUri !== ""
            && root.pendingUri.indexOf(encodeURIComponent(modelData.id)) !== -1

          width: list.width
          height: list.rowHeight
          radius: Style.spacing.labelGap
          color: hot || isPending ? Style.selectedFillFor(root.bar.foreground, Color.accent) : "transparent"
          borderSpec: hot ? Border.controlSpec("normal", root.bar.foreground, Color.accent) : Border.none()

          Row {
            anchors.fill: parent
            anchors.leftMargin: Style.space(6)
            anchors.rightMargin: Style.space(6)
            spacing: Style.space(10)

            Item {
              width: Style.space(34)
              height: Style.space(34)
              anchors.verticalCenter: parent.verticalCenter

              Image {
                id: cover
                anchors.fill: parent
                fillMode: Image.PreserveAspectCrop
                asynchronous: true
                sourceSize.width: 96
                sourceSize.height: 96
                source: rowItem.modelData.art ? "file://" + root.imagesDir + rowItem.modelData.art : ""
                visible: status === Image.Ready
              }
              Text {
                anchors.centerIn: parent
                visible: !cover.visible
                text: root.tab === "Albums" ? "󰀥" : "󰲸"
                color: Qt.darker(root.bar.foreground, 1.4)
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.subtitle
              }
            }

            Column {
              anchors.verticalCenter: parent.verticalCenter
              width: parent.width - Style.space(44)
              spacing: Style.space(1)

              Text {
                textFormat: Text.PlainText
                text: rowItem.modelData.name || "Untitled"
                color: root.bar.foreground
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.bodySmall
                elide: Text.ElideRight
                width: parent.width
              }
              Text {
                textFormat: Text.PlainText
                readonly property int n: (rowItem.modelData.files || []).length
                text: rowItem.isPending ? "Opening NeuroStream…"
                  : (rowItem.modelData.artist ? rowItem.modelData.artist + "  ·  " : "")
                    + n + (n === 1 ? " song" : " songs")
                color: Qt.darker(root.bar.foreground, 1.5)
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.caption
                elide: Text.ElideRight
                width: parent.width
              }
            }
          }

          MouseArea {
            id: rowMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.playCollection(root.tab === "Albums" ? "album" : "playlist", rowItem.modelData.id)
          }
        }
      }
    }
  }
}
