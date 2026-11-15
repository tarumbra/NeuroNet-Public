# NeuroNet quick access

NeuroNet runs in the background from the moment you log in. A key brings any
of NeuroNet's tools up as a popup over whatever you're doing, and the same key
puts it away again. It is always the one NeuroNet, so your place, your music
and your unsaved work carry on while it's hidden.

## The keys

| Keys | What it does |
|---|---|
| **Super + Alt + P** | Photos |
| **Super + Alt + Z** | Mindfulness (Z for zen) |
| **Super + Alt + C** | Cashbox (NeuroNet's Money section) |
| **Super + Alt + Q** | Puzzles (Q for quiz) |
| **Super + Alt + D** | Divination |
| **Super + Alt + I** | M&T (Media and Things) on its media pages: Media, inventories (I for items; Super + Alt + S is Omarchy's) |
| **Super + Alt + R** | Kitchen (R for recipes; Super + Alt + K is Omarchy's) |
| **Super + Alt + M** | M&T on its music pages: Library, Albums, Playlists |
| **Super + Alt + T** | NeuroTrain, the training planner; again to tuck it away (NeuroNet Training where it isn't installed) |
| **Super + Alt + H** | Home (the dashboard) |
| **Super + Alt + N** | Scribe (Notes, Cells, Fleeting, notebooks, ebooks) |
| **Super + Alt + B** | Creative (Scrapbook, Boards, Paper creator, Assets) |
| **Super + Alt + E** | Code: the IDE (E for editor) |
| **Super + Alt + O** | The whole NeuroNet, as a normal window. Press again to hide it. |
| **Super + Alt + A** | NeuroNet in the Omarchy menu: type part of a note, album, playlist, recipe or tool, then Enter (README: "NeuroNet in the Omarchy menu"). |
| **Super + Alt + X** | Capture: drag a box on the screen and it goes straight into Photos → Captures. |
| **Super + Alt + \\** | NeuroNet music: play / pause |
| **Super + Alt + ]** / **[** | NeuroNet music: next / previous track |
| **Super + Alt + G** | NeuroPets, the game, in its own window (G for game). Again to tuck it away, like Super + Alt + O. |
| **Super + Alt + U** | The Claude dock: tucks the Claude chat you're in into the top bar (the ✳ flashes when it replies). Again, or a click on the ✳, brings one back; right click brings them all back. |
| **Super + Alt + L** | Edit desktop (L for layout): every desktop widget shows its outline, ⚙ and Hide, and can be dragged. Again, or Done at the top of the screen, and they stay put. |

Every tool has a key, in the same order as NeuroNet's left menu. Each opens
as a popup.

- **The same key again** hides the popup.
- **Another tool's key** switches the popup to that tool.
- Each tool opens on **the page you were last on** in it. Notes, for example,
  goes back to Journal if that's where you were.

## What the popup looks like

- It floats in the middle of the screen, at about three quarters of its
  width and height.
- **The left menu is hidden.** The top bar (with the music player) and the
  right-hand menu (Scribe, Fleeting, Journal and so on) stay.
- **⤢**, next to the Multitask button in the top bar, opens the whole app
  from the popup. So does Super + Alt + O.

**Opening something else while a tool is up** — Print, a browser, a film —
turns the tool into a window beside it on your workspace, so the two stay
separate. Press the tool's key to put it away again.

## On the top bar

Two ways in from the bar:

- **The brain icon** (next to the Omarchy menu) opens a menu of every
  tool, the whole app and each one's keys. Middle-click it to show or
  hide the popup. The icon is dim while NeuroNet isn't running.
- **The NeuroNet app icon** in the app launcher always brings the whole app
  forward. It never hides it.

## Starting and stopping

- **At login** NeuroNet starts by itself, hidden, so the keys work
  straight away.
- **It never flashes up when it starts.** It always starts hidden and shows
  only when you ask for it.
- **If it isn't running**, any of the keys starts it and then shows the
  tool. The first time takes a few seconds.
- **There is only ever one NeuroNet.** Opening it again (the app icon, the
  launcher, a key) brings the running one forward instead of starting a
  second copy. Two copies would overwrite each other's saves.
- **To quit it**, close the window as usual. The next key press or the next
  login starts it again.

## If a key does nothing

1. Check NeuroNet is running. The brain icon on the bar is bright when it
   is. If it isn't, press any of the keys, or run
   `/home/tarumbra/DataDrive/NeuroNet/neuronet-quick start`.
2. Check the keys are loaded. **Super + K** lists every shortcut, and the six
   twelve NeuroNet ones start with "NeuroNet".
3. If the popup appears but doesn't switch to the tool, NeuroNet is running
   older code. Close it and press the key again.

## Where it's all set up

| What | Where |
|---|---|
| The keys | `~/.config/hypr/bindings.lua` (the "NeuroNet quick access" block) |
| Starting hidden at login | `~/.config/hypr/autostart.lua` (`neuronet-quick start`) |
| Every NeuroNet window starts hidden | `~/.config/hypr/hyprland.lua` (the `o.window("^(NeuroNet)$", ...)` line) |
| The app icon | `~/.local/share/applications/NeuroNet.desktop` (runs `neuronet-quick show`) |
| The bar menu | `~/.config/omarchy/plugins/neuronet.launcher/` (copy in `omarchy-plugin/`) |
| Moving the window | `neuronet-quick`, in this folder |
| Showing the tool, compact look | `SS.quickMode` in `ui/app.js`, `org.neuronet.App` in `mpris.py` |

**To change a key**, edit its line in `bindings.lua`. Hyprland reloads by
itself, and Super + K shows what's already taken. Backups made when these
were added sit beside each file as `*.bak.<number>`.

## `neuronet-quick` commands

The keys and the bar all run this script, and you can run it yourself:

| Command | Does |
|---|---|
| `neuronet-quick notes` (or photos, mind, money, games, divination, stuff, cookery, music, training, home, code) | That tool as a popup. Hides it if it's already up. |
| `neuronet-quick full` | The whole app here. Hides it if it's already here (Super + Alt + O). |
| `neuronet-quick show` | The whole app here, and never hides it (the app icon). |
| `neuronet-quick hide` | Puts the popup away. |
| `neuronet-quick toggle` | Shows or hides the popup as it was. |
| `neuronet-quick start` | Starts NeuroNet hidden if it isn't running (login). |

The full path is `/home/tarumbra/DataDrive/NeuroNet/neuronet-quick`.
