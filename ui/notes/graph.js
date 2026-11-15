/* ============================================================================
   Amnesia — the web of knowledge.

   A force-directed graph of the vault's [[links]], laid out and drawn to
   read as a spider's web rather than as the usual scatter of dots.

   WHERE THE LINKS COME FROM. Nowhere new. The graph runs the vault's text
   through CC.md.extractLinks — the same extractor the editor, the backlinks
   panel and the link autocomplete already use. That is deliberate: a graph
   with its own regex would eventually disagree with the backlinks panel
   about what links to what, and there would be no way to tell which was
   right.

   WHAT MAKES IT LOOK LIKE A WEB. Three things, and only one of them is the
   layout:

     Rings.    Notes are pulled toward a radius set by how far they sit from
               the most connected note. Hubs end up near the middle, leaves
               further out, so the graph forms concentric bands the way a
               web does — rather than the even blob a plain force layout
               gives.
     Threads.  Links are drawn as curved silk rather than straight lines,
               sagging slightly like thread under its own weight.
     Scaffold. Faint guide circles and spokes sit behind everything.

   The scaffold is drawn in a visibly different weight and colour from the
   threads, and is never clickable. That matters more than it sounds: this
   is a graph of what links to what, and a decorative line that could be
   mistaken for a relationship would make the whole thing lie.
   ========================================================================== */
window.CC = window.CC || {};

CC.Graph = (() => {
  "use strict";

  /* Beyond this the O(n²) repulsion starts to be felt on every frame. A
     personal vault is nowhere near it; a vault that is gets a warning and a
     still layout rather than a janky one. */
  const SIM_LIMIT = 600;
  const TICKS = 260;

  /**
   * Build nodes and edges from the vault's notes.
   *
   * A link resolves by title, case-insensitively, because that is how the
   * editor's own autocomplete resolves them. A link to a title that does
   * not exist is kept as a "missing" node — those are usually a typo or a
   * note yet to be written, and hiding them would hide exactly the thing
   * the graph is useful for spotting.
   */
  function build(notes) {
    const byTitle = new Map();
    const nodes = [];

    for (const note of notes) {
      const node = {
        id: note.path,
        title: note.title,
        folder: note.folder || "",
        missing: false,
        out: new Set(),
        in: new Set(),
      };
      nodes.push(node);
      const key = note.title.toLowerCase();
      if (!byTitle.has(key)) byTitle.set(key, node);
    }

    const edges = [];
    const seen = new Set();

    for (const note of notes) {
      const from = byTitle.get(note.title.toLowerCase());
      const titles = CC.md.extractLinks(note.text || []);
      for (const title of titles) {
        const key = title.toLowerCase();
        let to = byTitle.get(key);
        if (!to) {
          to = {
            id: `missing:${key}`, title, folder: "", missing: true,
            out: new Set(), in: new Set(),
          };
          byTitle.set(key, to);
          nodes.push(to);
        }
        if (to === from) continue;             // a note linking to itself
        const pair = `${from.id}\u0000${to.id}`;
        if (seen.has(pair)) continue;
        seen.add(pair);
        edges.push({ source: from, target: to });
        from.out.add(to.id);
        to.in.add(from.id);
      }
    }

    for (const node of nodes) {
      node.degree = node.out.size + node.in.size;
    }
    return { nodes, edges };
  }

  /**
   * How many links away each node is from the busiest one.
   *
   * This is what produces the rings. Breadth-first from the most connected
   * node; anything unreachable — an island, or a note with no links at all
   * — is given the outermost ring, which is where an unconnected note
   * belongs both visually and conceptually.
   */
  function assignDepth(nodes, edges) {
    if (!nodes.length) return 0;
    const neighbours = new Map(nodes.map((n) => [n.id, []]));
    for (const edge of edges) {
      neighbours.get(edge.source.id).push(edge.target.id);
      neighbours.get(edge.target.id).push(edge.source.id);
    }

    const hub = nodes.reduce((best, n) => (n.degree > best.degree ? n : best),
                             nodes[0]);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const node of nodes) node.depth = null;

    hub.depth = 0;
    const queue = [hub.id];
    let deepest = 0;
    while (queue.length) {
      const id = queue.shift();
      const here = byId.get(id);
      for (const next of neighbours.get(id) || []) {
        const node = byId.get(next);
        if (node && node.depth === null) {
          node.depth = here.depth + 1;
          deepest = Math.max(deepest, node.depth);
          queue.push(next);
        }
      }
    }
    const rim = deepest + 1;
    for (const node of nodes) {
      if (node.depth === null) node.depth = rim;       // unreachable
    }
    return Math.max(rim, 1);
  }

  /**
   * Settle the layout.
   *
   * Three forces: nodes push each other apart, links pull their ends
   * together, and every node is drawn toward the ring its depth puts it on.
   * The ring force is what turns a blob into a web; without it this is the
   * same scatter every graph view produces.
   *
   * Run to completion before drawing rather than animated. A graph that
   * jitters into place looks impressive once and is irritating every time
   * after, and there is nothing to learn from watching it settle.
   */
  function layout(graph, { width, height }) {
    const { nodes, edges } = graph;
    if (!nodes.length) return { rings: 0 };

    const rings = assignDepth(nodes, edges);
    const centreX = width / 2;
    const centreY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 60;
    /* The outermost ring holds depth === rings (the unreachable notes), and
       a node sits at ringGap * (depth + 0.5). Dividing by `rings` alone put
       that last ring at maxRadius * (rings + 0.5) / rings — outside the
       viewBox, so unlinked notes were drawn off the edge of the picture.
       Dividing by rings + 0.5 lands the outermost ring exactly on it. */
    const ringGap = maxRadius / (rings + 0.5);

    // Start on the ring, spread by angle, so the simulation begins near the
    // shape it should end in and needs far fewer ticks to settle.
    nodes.forEach((node, i) => {
      const radius = ringGap * (node.depth + 0.5);
      const angle = (i / nodes.length) * Math.PI * 2
        + node.depth * 0.7;          // offset per ring so spokes do not line up
      node.x = centreX + Math.cos(angle) * radius;
      node.y = centreY + Math.sin(angle) * radius;
      node.vx = 0;
      node.vy = 0;
      node.ring = radius;
    });

    if (nodes.length > SIM_LIMIT) {
      return { rings, ringGap, centreX, centreY, skipped: true };
    }

    const repulsion = 2600;
    const springLength = 90;
    const springStrength = 0.02;
    const ringStrength = 0.035;
    const damping = 0.86;

    for (let tick = 0; tick < TICKS; tick += 1) {
      // Push apart.
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 0.01) {
            // Exactly coincident nodes have no direction to separate along,
            // so give them one rather than dividing by zero.
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            distance = 0.01;
          }
          const force = repulsion / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }

      // Pull linked pairs together.
      for (const edge of edges) {
        const a = edge.source;
        const b = edge.target;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (distance - springLength) * springStrength;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Hold each node near its own ring.
      for (const node of nodes) {
        const dx = node.x - centreX;
        const dy = node.y - centreY;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const pull = (node.ring - distance) * ringStrength;
        node.vx += (dx / distance) * pull;
        node.vy += (dy / distance) * pull;
      }

      for (const node of nodes) {
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
      }
    }

    return { rings, ringGap, centreX, centreY, skipped: false };
  }

  /** A link drawn as thread: a quadratic curve sagging away from centre. */
  function threadPath(a, b, centreX, centreY) {
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    // Bow away from the middle of the web, which is what makes a run of
    // threads read as silk between spokes rather than as a straight mesh.
    const dx = midX - centreX;
    const dy = midY - centreY;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const sag = Math.min(26, Math.hypot(b.x - a.x, b.y - a.y) * 0.16);
    const cx = midX + (dx / distance) * sag;
    const cy = midY + (dy / distance) * sag;
    return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }

  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /** The whole thing as SVG. */
  function render(graph, geometry, { width, height, spokes = 12 }) {
    const { centreX, centreY, ringGap, rings } = geometry;

    // The scaffold: guide circles and spokes. Deliberately a different
    // weight and colour from the threads, and never clickable, so nothing
    // here can be mistaken for a link.
    let scaffold = "";
    for (let r = 1; r <= rings; r += 1) {
      scaffold += `<circle class="cx-web-ring" cx="${centreX}" cy="${centreY}" `
        + `r="${(ringGap * (r - 0.5)).toFixed(1)}"/>`;
    }
    const reach = ringGap * (rings - 0.5);
    for (let i = 0; i < spokes; i += 1) {
      const angle = (i / spokes) * Math.PI * 2;
      scaffold += `<line class="cx-web-spoke" x1="${centreX}" y1="${centreY}" `
        + `x2="${(centreX + Math.cos(angle) * reach).toFixed(1)}" `
        + `y2="${(centreY + Math.sin(angle) * reach).toFixed(1)}"/>`;
    }

    const threads = graph.edges.map((edge) =>
      `<path class="cx-web-thread" d="${threadPath(edge.source, edge.target, centreX, centreY)}" `
      + `data-from="${esc(edge.source.id)}" data-to="${esc(edge.target.id)}"/>`
    ).join("");

    const dots = graph.nodes.map((node) => {
      const radius = Math.min(13, 4.5 + Math.sqrt(node.degree) * 2.4);
      return `<g class="cx-web-node ${node.missing ? "is-missing" : ""} `
        + `${node.degree === 0 ? "is-lonely" : ""}" data-id="${esc(node.id)}" `
        + `transform="translate(${node.x.toFixed(1)},${node.y.toFixed(1)})">`
        + `<circle class="cx-web-halo" r="${(radius + 7).toFixed(1)}"/>`
        + `<circle class="cx-web-dot" r="${radius.toFixed(1)}"/>`
        + `<text class="cx-web-label" y="${(radius + 13).toFixed(1)}">`
        + `${esc(node.title)}</text></g>`;
    }).join("");

    return `<svg class="cx-web-svg" viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">
      <g class="cx-web-scaffold">${scaffold}</g>
      <g class="cx-web-threads">${threads}</g>
      <g class="cx-web-nodes">${dots}</g>
    </svg>`;
  }

  return { build, layout, render, assignDepth, threadPath, SIM_LIMIT };
})();
