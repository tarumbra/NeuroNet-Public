import QtQuick

// A neuron: a soma and five dendrites, each ending in a node -- the mark on
// the dock's launcher and on its tucked-away handle. Drawn, not an image, so
// it takes any colour and stays crisp at any size.
Canvas {
  id: glyph
  property color color: "#5FA665"
  property real stroke: Math.max(1.2, width / 16)
  onColorChanged: requestPaint()
  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  antialiasing: true

  onPaint: {
    var c = getContext("2d")
    var s = Math.min(width, height)
    c.reset()
    c.save()
    c.translate(width / 2, height / 2)
    c.strokeStyle = glyph.color
    c.fillStyle = glyph.color
    c.lineWidth = glyph.stroke
    c.lineCap = "round"
    var soma = s * 0.17
    // dendrites: angle, length, and whether they branch
    var arms = [[-100, 0.43, true], [-30, 0.4, false], [35, 0.42, true], [115, 0.4, false], [180, 0.38, true]]
    for (var i = 0; i < arms.length; i++) {
      var a = arms[i][0] * Math.PI / 180, L = s * arms[i][1]
      var ex = Math.cos(a) * L, ey = Math.sin(a) * L
      c.beginPath(); c.moveTo(Math.cos(a) * soma, Math.sin(a) * soma); c.lineTo(ex, ey); c.stroke()
      c.beginPath(); c.arc(ex, ey, s * 0.055, 0, Math.PI * 2); c.fill()
      if (arms[i][2]) {
        var b = a + 0.75, mx = Math.cos(a) * L * 0.6, my = Math.sin(a) * L * 0.6
        var bx = mx + Math.cos(b) * s * 0.16, by = my + Math.sin(b) * s * 0.16
        c.beginPath(); c.moveTo(mx, my); c.lineTo(bx, by); c.stroke()
        c.beginPath(); c.arc(bx, by, s * 0.04, 0, Math.PI * 2); c.fill()
      }
    }
    // the soma: a ring with a lit nucleus
    c.beginPath(); c.arc(0, 0, soma, 0, Math.PI * 2); c.stroke()
    c.beginPath(); c.arc(0, 0, soma * 0.42, 0, Math.PI * 2); c.fill()
    c.restore()
  }
}
