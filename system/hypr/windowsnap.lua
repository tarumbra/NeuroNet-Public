-- Window snap, like Windows (16 Nov 2026).
--
-- Cam: "So i can drag a window to a side of the screen and it will snap and
-- take up that side of the screen."
--
-- Drag a FLOATING window (Super + left drag, or by its title bar on Omarchy's floating workspaces)
-- until the pointer touches the screen's edge, and let go:
--   left / right edge   -> that half of the screen
--   a corner            -> that quarter
--   top edge            -> the whole screen (below the bar); pointer up into the bar counts
--   bottom edge         -> the bottom half
-- While the pointer is in a zone, an outline shows where it will go (drawn by
-- the shell plugin neuronet.snap, told through a custom Hyprland event).
-- Drag a snapped window away and let go anywhere else: it gets its old size
-- back, under the pointer. (Hyprland fixes the drag's offset when it starts,
-- so the size comes back on the drop, not mid-drag.)
-- Hyprland's own magnet snap (general.snap in looknfeel.lua) is untouched.
--
-- Cost: Super-drags: a 30 ms timer only while the left button is held. Title-bar drags (the hyprbars
-- plugin takes those clicks, so no binding sees them): a 50 ms look at the focused window's position,
-- only while a floating window has the focus. Both are a few field reads inside Hyprland.
--
-- Part of NeuroNet's desktop layer: system/hypr/windowsnap.lua, installed by system/install.sh as
-- ~/.config/hypr/neuronet-windowsnap.lua and loaded from NeuroNet's block in hyprland.lua (collect.sh
-- brings an edited live copy back). Turn it off: delete that file (the block skips a missing one).
-- Look inside while it runs:  hyprctl repl 'return _G.__snap.debug()'

local S = _G.__snap or {}
_G.__snap = S
if S.timer then pcall(function() S.timer:set_enabled(false) end) end
S.timer, S.drag = nil, nil
S.keyWorks = nil
S.saved = S.saved or {}   -- address -> {w, h} from before it was snapped
S.snapped = S.snapped or {} -- address -> true while it sits in a zone

local EDGE = 10      -- logical px from the screen edge that count as "touching" it
local CORNER = 140   -- how far along an edge from a corner still means the corner
local TICK = 30      -- ms between looks while the button is held (Super-drags)
local MAX_HOLD = 120000 -- give up after 2 minutes held, whatever happens

-- the last 60 things the snap saw, for working out a drag that went wrong:
--   hyprctl repl 'return _G.__snap.dump()'
S.log = S.log or {}
local function note(msg)
  local c = hl.get_cursor_pos()
  S.log[#S.log + 1] = string.format("%s %s%s", os.date("%H:%M:%S"), msg, c and string.format(" (pointer %d,%d)", math.floor(c.x), math.floor(c.y)) or "")
  while #S.log > 60 do table.remove(S.log, 1) end
end
S.dump = function() return table.concat(S.log, "\n") end

local function num(v)
  if type(v) == "table" then return v.top or v[1] or 0 end
  return tonumber(v) or 0
end

local function emit(s)
  hl.dispatch(hl.dsp.event("neurosnap " .. s))
end

-- the usable area of a monitor: inside the bar(s) and the outer gaps (logical px)
local function area(m)
  local r = m.reserved or {}
  local g = num((hl.get_config("general.gaps_out")))
  local mw, mh = m.width / m.scale, m.height / m.scale
  if m.transform == 1 or m.transform == 3 or m.transform == 5 or m.transform == 7 then mw, mh = mh, mw end
  local x = m.x + (r.left or 0) + g
  local y = m.y + (r.top or 0) + g
  return { x = x, y = y, w = mw - (r.left or 0) - (r.right or 0) - 2 * g,
           h = mh - (r.top or 0) - (r.bottom or 0) - 2 * g, mw = mw, mh = mh }
end

-- which zone the pointer is in, and the box it means; nil when none
local function zoneAt(c, m)
  local mw, mh = m.width / m.scale, m.height / m.scale
  local left, right = c.x <= m.x + EDGE, c.x >= m.x + mw - 1 - EDGE
  -- the top counts from anywhere up in the bar (the magnet holds the window just under it)
  local barTop = (m.reserved and m.reserved.top) or 0
  local top, bottom = c.y <= m.y + math.max(EDGE, barTop / 2), c.y >= m.y + mh - 1 - EDGE
  local nearTop, nearBottom = c.y <= m.y + CORNER, c.y >= m.y + mh - CORNER
  local nearLeft, nearRight = c.x <= m.x + CORNER, c.x >= m.x + mw - CORNER
  local a = area(m)
  local gi = num((hl.get_config("general.gaps_in")))
  local hw, hh = (a.w - gi) / 2, (a.h - gi) / 2
  local L, R = a.x, a.x + hw + gi
  local T, B = a.y, a.y + hh + gi
  local function box(name, x, y, w, h) return { name = name, x = x, y = y, w = w, h = h } end
  if (left and nearTop) or (top and nearLeft) then return box("top-left", L, T, hw, hh) end
  if (right and nearTop) or (top and nearRight) then return box("top-right", R, T, hw, hh) end
  if (left and nearBottom) or (bottom and nearLeft) then return box("bottom-left", L, B, hw, hh) end
  if (right and nearBottom) or (bottom and nearRight) then return box("bottom-right", R, B, hw, hh) end
  if left then return box("left", L, a.y, hw, a.h) end
  if right then return box("right", R, a.y, hw, a.h) end
  if top then return box("full", a.x, a.y, a.w, a.h) end
  if bottom then return box("bottom", a.x, B, a.w, hh) end
  return nil
end

local function place(addr, x, y, w, h)
  local sel = "address:" .. addr
  hl.dispatch(hl.dsp.window.resize({ x = math.floor(w + 0.5), y = math.floor(h + 0.5), relative = false, window = sel }))
  hl.dispatch(hl.dsp.window.move({ x = math.floor(x + 0.5), y = math.floor(y + 0.5), relative = false, window = sel }))
end

-- ---- one drag: start, follow, drop (shared by both ways of noticing a drag) -------------------------

-- d = { addr, x0, y0, w0, h0, grabX, grabY, moved, zone, zkey, shown, via }
local function follow(d)
  local c, m = hl.get_cursor_pos(), hl.get_monitor_at_cursor()
  if not c or not m then return end
  d.miny = math.min(d.miny or c.y, c.y); d.maxy = math.max(d.maxy or c.y, c.y)
  d.minx = math.min(d.minx or c.x, c.x); d.maxx = math.max(d.maxx or c.x, c.x)
  local z = zoneAt(c, m)
  local key = z and (z.name .. m.name) or ""
  if key ~= d.zkey then
    d.zkey, d.zone = key, z
    note("zone: " .. (z and z.name or "none"))
    if z then
      emit(string.format("show %d %d %d %d %s", math.floor(z.x), math.floor(z.y), math.floor(z.w), math.floor(z.h), m.name))
      d.shown = true
    elseif d.shown then
      emit("hide")
    end
  end
end

-- the drag is over: snap, restore or leave it be
local function drop(d)
  if not d then return end
  note(string.format("drop (%s): window=%s moved=%s zone=%s reach x %s..%s y %s..%s", d.via or "?", tostring(d.cls), tostring(d.moved),
    d.zone and d.zone.name or "none", tostring(d.minx and math.floor(d.minx)), tostring(d.maxx and math.floor(d.maxx)),
    tostring(d.miny and math.floor(d.miny)), tostring(d.maxy and math.floor(d.maxy))))
  if d.shown then emit("hide") end
  if not d.moved or not d.addr then return end
  local zone, addr = d.zone, d.addr
  -- after Hyprland has finished its own end-of-drag
  S.after = hl.timer(function()
    local w = hl.get_window("address:" .. addr)
    if not w or not w.floating then return end
    if zone then
      if not S.snapped[addr] then S.saved[addr] = { w = d.w0, h = d.h0 } end
      S.snapped[addr] = true
      place(addr, zone.x, zone.y, zone.w, zone.h)
    elseif S.snapped[addr] then
      S.snapped[addr] = nil
      local old = S.saved[addr]
      S.saved[addr] = nil
      if old then
        local c = hl.get_cursor_pos() or { x = w.at.x, y = w.at.y }
        -- keep the pointer at the same spot across the window, and as far down as it was
        local fx = d.w0 > 0 and (d.grabX / d.w0) or 0.5
        local x = c.x - fx * old.w
        local y = c.y - math.min(d.grabY, old.h - 10)
        local m = hl.get_monitor_at_cursor()
        if m then
          local a = area(m)
          x = math.max(a.x, math.min(x, a.x + a.w - old.w))
          y = math.max(a.y, math.min(y, a.y + a.h - 40))
        end
        place(addr, x, y, old.w, old.h)
      end
    end
    -- the watcher must not take our own move for a drag
    if S.watch then S.watch.addr = nil end
  end, { timeout = 40, type = "oneshot" })
end

local function startDrag(w, atX, atY, grabX, grabY, via)
  note(string.format("drag (%s) on %s at %d,%d size %dx%d", via, w.class, atX, atY, w.size.x, w.size.y))
  return { addr = w.address, cls = w.class, x0 = atX, y0 = atY, w0 = w.size.x, h0 = w.size.y,
           grabX = grabX, grabY = grabY, moved = true, via = via }
end

-- ---- way 1: Super + left drag (and anything else Hyprland's bindings see) ----------------------------
-- A pass-through binding on the left button; a 30 ms timer only while it is held.

local function stopHold()
  if S.timer then pcall(function() S.timer:set_enabled(false) end) end
  S.timer = nil
end

local function holdEnd()
  local h = S.drag
  -- a title-bar drag the watcher is following: if this release reaches us, it ends right now
  if not h and S.watch and S.watch.d then
    note("button up (title-bar drag)")
    drop(S.watch.d); S.watch.d = nil
    return
  end
  stopHold()
  S.drag = nil
  if h and h.d then drop(h.d) end
end

local function holdTick()
  local h = S.drag
  if not h then return stopHold() end
  h.ticks = h.ticks + 1
  if h.ticks * TICK > MAX_HOLD then return holdEnd() end
  local w = hl.get_active_window()
  if not w then return end
  if not h.addr then
    if not w.floating or w.fullscreen ~= 0 then return end
    local c = hl.get_cursor_pos()
    h.addr, h.x0, h.y0 = w.address, w.at.x, w.at.y
    h.gx, h.gy = c and (c.x - w.at.x) or w.size.x / 2, c and (c.y - w.at.y) or 20
    return
  end
  if w.address ~= h.addr then return end
  if not h.d then
    if math.abs(w.at.x - h.x0) < 3 and math.abs(w.at.y - h.y0) < 3 then return end
    h.d = startDrag(w, h.x0, h.y0, h.gx, h.gy, "super")
  end
  follow(h.d)
end

local function holdStart()
  if S.drag then return end
  S.drag = { ticks = 0 }
  S.timer = hl.timer(holdTick, { timeout = TICK, type = "repeat" })
end

hl.bind("mouse:272", holdStart, { non_consuming = true, ignore_mods = true, transparent = true, description = "Window snap: watch a drag" })
hl.bind("mouse:272", holdEnd, { release = true, non_consuming = true, ignore_mods = true, transparent = true, description = "Window snap: drop" })

-- ---- way 2: title bars (Omarchy's floating workspaces) -------------------------------------------------
-- The title-bar plugin (hyprbars) takes the click itself, so no binding ever sees it. Instead, while the
-- focused window is floating, look every WATCH ms: a window that moves while staying the same distance
-- from the pointer is being dragged; once the pointer moves and the window doesn't, the button is up.
-- The watcher only runs while a floating window has the focus (switched on and off by focus events).

local WATCH = 50
local RELEASE = 45   -- px the pointer must travel without the window before it counts as let go

local function watchTick()
  local W = S.watch
  if not W then return end
  if S.drag and S.drag.d then return end       -- way 1 has this drag
  local w = hl.get_active_window()
  local c = hl.get_cursor_pos()
  if not w or not c or not w.floating or w.fullscreen ~= 0 then
    if W.d then drop(W.d); W.d = nil end
    W.addr = nil
    return
  end
  local ax, ay = w.at.x, w.at.y
  local ox, oy = c.x - ax, c.y - ay
  if W.addr ~= w.address then
    if W.d then drop(W.d); W.d = nil end
    W.addr, W.ax, W.ay, W.ox, W.oy = w.address, ax, ay, ox, oy
    return
  end
  local moved = math.abs(ax - W.ax) >= 1 or math.abs(ay - W.ay) >= 1
  local same = math.abs(ox - W.ox) < 2 and math.abs(oy - W.oy) < 2
  if moved and same then
    -- following the pointer: a drag
    if not W.d then W.d = startDrag(w, W.ax, W.ay, W.ox, W.oy, "titlebar") end
    follow(W.d)
  elseif W.d and not moved and not same then
    -- the pointer went on without it: let go -- but the magnet (general.snap, 30 px) also holds a
    -- window still for a while, so only once the pointer is well past where the window stopped
    W.sx, W.sy = W.sx or (ax + W.ox), W.sy or (ay + W.oy)
    if math.abs(c.x - W.sx) + math.abs(c.y - W.sy) > RELEASE then
      drop(W.d); W.d = nil
    else
      follow(W.d)
    end
  elseif W.d and moved and not same then
    -- moved some other way (a key, the magnet at an edge): keep following
    follow(W.d)
  end
  if moved then W.sx, W.sy = nil, nil end
  W.ax, W.ay, W.ox, W.oy = ax, ay, ox, oy
end

local function watchOn(on)
  if on and not S.watchTimer then
    S.watch = {}
    S.watchTimer = hl.timer(watchTick, { timeout = WATCH, type = "repeat" })
  elseif not on and S.watchTimer then
    if S.watch and S.watch.d then drop(S.watch.d) end
    pcall(function() S.watchTimer:set_enabled(false) end)
    S.watchTimer, S.watch = nil, nil
  end
end

local function refresh()
  local w = hl.get_active_window()
  watchOn(w ~= nil and w.floating and w.fullscreen == 0 and not (w.workspace and w.workspace.special))
end

if S.watchTimer then pcall(function() S.watchTimer:set_enabled(false) end) end
S.watchTimer, S.watch = nil, nil
S.refresh = refresh
if not S.hooked2 then
  S.hooked2 = true
  -- a closed window forgets its saved size
  hl.on("window.destroy", function(w)
    pcall(function()
      local a = w and w.address
      if a then _G.__snap.saved[a], _G.__snap.snapped[a] = nil, nil end
    end)
  end)
  -- the title-bar watcher follows the focus
  for _, ev in ipairs({ "window.active", "workspace.active", "window.update_rules", "window.fullscreen", "window.destroy" }) do
    hl.on(ev, function() pcall(function() _G.__snap.refresh() end) end)
  end
end
refresh()

S.debug = function()
  local n = 0
  for _ in pairs(S.saved) do n = n + 1 end
  return string.format("holding=%s watching=%s dragging=%s snapped=%d",
    tostring(S.drag ~= nil), tostring(S.watchTimer ~= nil), tostring((S.watch and S.watch.d) ~= nil or (S.drag and S.drag.d) ~= nil), n)
end
