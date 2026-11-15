-- NeuroNet: a live synapse -- the active window is outlined in NeuroNet
-- green firing into cyan, with a soft green glow; idle windows sit dim.
local active_border_color = { colors = { "rgba(5fa665ff)", "rgba(00e5ffff)" }, angle = 45 }
local inactive_border_color = "rgba(1b332299)"
local active_shadow_color = "rgba(5fa66566)"
local inactive_shadow_color = "rgba(00000099)"

hl.config({
  general = {
    col = {
      active_border = active_border_color,
      inactive_border = inactive_border_color,
    },
  },

  group = {
    col = {
      border_active = active_border_color,
      border_inactive = inactive_border_color,
    },
  },

  decoration = {
    shadow = {
      enabled = true,
      range = 14,
      render_power = 3,
      color = active_shadow_color,
      color_inactive = inactive_shadow_color,
    },
  },
})
