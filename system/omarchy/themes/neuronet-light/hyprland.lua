-- NeuroNet Light: the active window outlined in NeuroNet deep green
-- running into teal, casting a soft green shadow on the sage paper.
local active_border_color = { colors = { "rgba(2e6b38ff)", "rgba(007c8cff)" }, angle = 45 }
local inactive_border_color = "rgba(98ad9e88)"
local active_shadow_color = "rgba(2e6b3855)"
local inactive_shadow_color = "rgba(1b2a1f22)"

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
