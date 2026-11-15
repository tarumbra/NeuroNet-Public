  // ---- illustrated scenes (2026-10-07, Cam OK'd "proper illustrated scenes" for the regions) ---------------
  // One SVG per region behind its pins: sky things, far hills or peaks, and the region's own props, drawn in
  // its palette (the arena's --sky/--hill/--ground colours). Positions come from a seeded roll, so a region
  // always looks the same.
  function sceneSVG(id) {
    if (modPics.regions[id]) return `<svg class="pp-scene" viewBox="0 0 1000 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <image href="${modPics.regions[id]}" x="0" y="0" width="1000" height="320" preserveAspectRatio="xMidYMid slice"/></svg>`;
    let seed = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const H = 154;                                                       // the horizon (the ground starts at 48%)
    const out = [];
    const cloud = (x, y, k, op) => out.push(`<g opacity="${op || 0.85}" fill="#fff"><ellipse cx="${x}" cy="${y}" rx="${46 * k}" ry="${16 * k}"/><ellipse cx="${x - 26 * k}" cy="${y + 4 * k}" rx="${28 * k}" ry="${12 * k}"/><ellipse cx="${x + 24 * k}" cy="${y - 6 * k}" rx="${30 * k}" ry="${14 * k}"/></g>`);
    const hills = (fill, op, amp, y0) => { let d = `M0 ${y0}`; for (let x = 0; x <= 1000; x += 100) d += ` Q${x + 50} ${y0 - amp * (0.5 + rnd())} ${x + 100} ${y0}`; out.push(`<path d="${d} L1000 ${H + 2} L0 ${H + 2} Z" fill="${fill}" opacity="${op}"/>`); };
    const peaks = (fill, snow, n, hmax) => { for (let i = 0; i < n; i++) { const x = (i + 0.3 * rnd()) * (1000 / n), w = 130 + 90 * rnd(), h = hmax * (0.6 + 0.4 * rnd());
      out.push(`<path d="M${x - w / 2} ${H} L${x} ${H - h} L${x + w / 2} ${H} Z" fill="${fill}"/>`);
      if (snow) out.push(`<path d="M${x - w * 0.14} ${H - h * 0.72} L${x} ${H - h} L${x + w * 0.14} ${H - h * 0.72} L${x + w * 0.05} ${H - h * 0.76} L${x - w * 0.04} ${H - h * 0.68} Z" fill="${snow}"/>`); } };
    const tree = (x, y, k, leaf, trunk) => out.push(`<g><rect x="${x - 3 * k}" y="${y - 14 * k}" width="${6 * k}" height="${14 * k}" fill="${trunk || "#6b4a2a"}"/><circle cx="${x}" cy="${y - 22 * k}" r="${13 * k}" fill="${leaf}"/><circle cx="${x - 8 * k}" cy="${y - 16 * k}" r="${9 * k}" fill="${leaf}"/><circle cx="${x + 8 * k}" cy="${y - 16 * k}" r="${9 * k}" fill="${leaf}"/></g>`);
    const pine = (x, y, k, leaf, snow) => out.push(`<g><rect x="${x - 2.5 * k}" y="${y - 8 * k}" width="${5 * k}" height="${8 * k}" fill="#5a3a22"/><path d="M${x - 14 * k} ${y - 6 * k} L${x} ${y - 44 * k} L${x + 14 * k} ${y - 6 * k} Z" fill="${leaf}"/>${snow ? `<path d="M${x - 6 * k} ${y - 30 * k} L${x} ${y - 44 * k} L${x + 6 * k} ${y - 30 * k} Z" fill="${snow}"/>` : ""}</g>`);
    const palm = (x, y, k) => out.push(`<g><path d="M${x} ${y} q${4 * k} ${-26 * k} ${-2 * k} ${-50 * k}" stroke="#8a6a3a" stroke-width="${5 * k}" fill="none"/>${[[-28, -6], [26, -4], [-18, 10], [20, 12], [0, -16]].map(([dx, dy]) => `<path d="M${x - 2 * k} ${y - 50 * k} q${dx * 0.5 * k} ${dy * k - 10 * k} ${dx * k} ${dy * k + 8 * k}" stroke="#3f8a3a" stroke-width="${5 * k}" fill="none" stroke-linecap="round"/>`).join("")}</g>`);
    const fence = (x1, x2, y) => { out.push(`<rect x="${x1}" y="${y - 12}" width="${x2 - x1}" height="3" fill="#8a6a42"/><rect x="${x1}" y="${y - 6}" width="${x2 - x1}" height="3" fill="#8a6a42"/>`); for (let x = x1; x <= x2; x += 22) out.push(`<rect x="${x}" y="${y - 16}" width="4" height="16" fill="#7a5a32"/>`); };
    const sea = (y, col) => { out.push(`<rect x="0" y="${y}" width="1000" height="${H - y + 4}" fill="${col}"/>`); for (let x = 20; x < 1000; x += 70) out.push(`<path d="M${x} ${y + 8 + 6 * rnd()} q8 -5 16 0" stroke="rgba(255,255,255,.6)" stroke-width="2" fill="none"/>`); };
    const flowers = (n, cols) => { for (let i = 0; i < n; i++) out.push(`<circle cx="${1000 * rnd()}" cy="${H + 8 + 150 * rnd()}" r="${2 + 2 * rnd()}" fill="${cols[i % cols.length]}" opacity=".85"/>`); };
    const tufts = (n, col) => { for (let i = 0; i < n; i++) { const x = 1000 * rnd(), y = H + 20 + 140 * rnd(); out.push(`<path d="M${x} ${y} l3 -9 l3 9 l3 -7 l2 7" stroke="${col}" stroke-width="2" fill="none" opacity=".55"/>`); } };
    const sun = (x, y, col) => out.push(`<circle cx="${x}" cy="${y}" r="26" fill="${col || "#fff4b0"}" opacity=".9"/>`);
    const stars = (n) => { for (let i = 0; i < n; i++) out.push(`<circle cx="${1000 * rnd()}" cy="${100 * rnd()}" r="${0.8 + 1.4 * rnd()}" fill="#fff" opacity="${0.4 + 0.5 * rnd()}"/>`); };
    const crystal = (x, y, k, col) => out.push(`<path d="M${x} ${y} l${-7 * k} ${-8 * k} l${7 * k} ${-26 * k} l${7 * k} ${26 * k} Z" fill="${col}" opacity=".9"/><path d="M${x} ${y} l0 ${-34 * k} l${7 * k} ${26 * k} Z" fill="#fff" opacity=".25"/>`);
    const scene = {
      farmyard() { sun(860, 50); cloud(200, 50, 1); cloud(560, 36, 0.8); hills("var(--hill)", 0.7, 30, H);
        out.push(`<g><rect x="640" y="${H - 52}" width="90" height="52" fill="#b8402e"/><path d="M630 ${H - 52} L685 ${H - 88} L740 ${H - 52} Z" fill="#8a2a1e"/><rect x="672" y="${H - 30}" width="26" height="30" fill="#f2e6c8"/><path d="M672 ${H - 30} l26 30 M698 ${H - 30} l-26 30" stroke="#b8402e" stroke-width="3"/></g>`);
        [[150, 0.9], [210, 0.7], [800, 0.8]].forEach(([x, k]) => out.push(`<path d="M${x - 24 * k} ${H} Q${x} ${H - 44 * k} ${x + 24 * k} ${H} Z" fill="#e8c860"/>`));
        fence(40, 400, H + 4); fence(760, 980, H + 4); tufts(30, "#8a7a3a"); },
      pasture() { sun(120, 50); cloud(420, 44, 1.1); cloud(800, 60, 0.8); hills("var(--hill)", 0.8, 40, H);
        out.push(`<g><rect x="760" y="${H - 64}" width="18" height="64" fill="#f2e6c8"/><path d="M754 ${H - 64} L769 ${H - 80} L784 ${H - 64} Z" fill="#a85a3a"/>${[0, 90, 180, 270].map((a) => `<rect x="767" y="${H - 108}" width="4" height="40" fill="#e8dcc0" transform="rotate(${a + 20} 769 ${H - 70})"/>`).join("")}</g>`);
        [80, 300, 520, 900].forEach((x) => tree(x, H, 0.9 + 0.3 * rnd(), "#5aa04a")); fence(0, 1000, H + 6); tufts(40, "#4a8a3a"); },
      meadow() { cloud(260, 40, 1); cloud(700, 56, 1.2); hills("var(--hill)", 0.7, 26, H);
        [140, 680, 860].forEach((x) => tree(x, H, 0.8 + 0.3 * rnd(), "#7cc06a"));
        [420, 470].forEach((x) => out.push(`<g><rect x="${x - 14}" y="${H - 28}" width="28" height="28" fill="#f2c43c"/><rect x="${x - 16}" y="${H - 32}" width="32" height="6" fill="#c8963c"/><rect x="${x - 3}" y="${H - 14}" width="6" height="4" fill="#3a2a10"/></g>`));
        flowers(90, ["#f08ab0", "#fff4b0", "#b9a3e3", "#ffffff", "#f29a2e"]); },
      forest() { cloud(500, 34, 0.9, 0.6); hills("var(--hill)", 0.9, 34, H);
        for (let i = 0; i < 16; i++) tree(20 + i * 64 + 20 * rnd(), H + 2, 1 + 0.5 * rnd(), i % 2 ? "#2f6a3a" : "#3f7a42", "#4a3020");
        tufts(40, "#2f6630"); out.push(`<g fill="#d9604f">${[120, 640, 910].map((x) => `<ellipse cx="${x}" cy="${H + 150}" rx="9" ry="6"/>`).join("")}</g>`); },
      deepforest() { stars(25); out.push(`<circle cx="840" cy="46" r="20" fill="#e8f0d8" opacity=".85"/>`); hills("#14302a", 0.9, 30, H);
        for (let i = 0; i < 22; i++) pine(i * 47 + 18 * rnd(), H + 4, 1.1 + 0.6 * rnd(), i % 2 ? "#123a24" : "#1a4a2e");
        tufts(30, "#0f2a1a"); out.push(`<g fill="#7ad0a0" opacity=".75">${[200, 520, 760].map((x) => `<circle cx="${x}" cy="${H + 130}" r="4"/>`).join("")}</g>`); },
      coast() { sun(150, 46); cloud(520, 40, 1); cloud(860, 30, 0.7); sea(H - 40, "#3a8ab8");
        out.push(`<g><rect x="830" y="${H - 96}" width="26" height="96" fill="#f2ece0"/><rect x="830" y="${H - 72}" width="26" height="12" fill="#c0503a"/><rect x="830" y="${H - 40}" width="26" height="12" fill="#c0503a"/><rect x="826" y="${H - 110}" width="34" height="16" fill="#3a3a44"/><circle cx="843" cy="${H - 102}" r="5" fill="#fff4b0"/></g>`);
        [[120, 30], [300, 18], [620, 24]].forEach(([x, r]) => out.push(`<ellipse cx="${x}" cy="${H - 2}" rx="${r}" ry="${r * 0.55}" fill="#7a7a82"/>`)); tufts(20, "#c8a868"); },
      jungle() { out.push(`<g fill="#ffffff" opacity=".35"><rect x="0" y="${H - 70}" width="1000" height="14"/></g>`); hills("var(--hill)", 0.9, 44, H);
        [60, 220, 470, 760, 940].forEach((x) => palm(x, H + 4, 1 + 0.4 * rnd()));
        out.push(`<g fill="#a8a088"><rect x="590" y="${H - 60}" width="18" height="60"/><rect x="640" y="${H - 44}" width="18" height="44"/><rect x="584" y="${H - 66}" width="80" height="10"/></g>`);
        for (let i = 0; i < 9; i++) out.push(`<path d="M${110 * i + 30} 0 q${-10 + 20 * rnd()} 40 0 ${50 + 50 * rnd()}" stroke="#2f7a2c" stroke-width="4" fill="none"/>`); tufts(40, "#23602a"); },
      deepjungle() { for (let i = 0; i < 14; i++) out.push(`<path d="M${75 * i} 0 q${-12 + 24 * rnd()} 50 ${4} ${70 + 70 * rnd()}" stroke="#0f4a2a" stroke-width="6" fill="none"/>`);
        hills("#0f3a22", 0.95, 30, H);
        out.push(`<g fill="#7a8a6a"><rect x="400" y="${H - 30}" width="200" height="30"/><rect x="430" y="${H - 58}" width="140" height="28"/><rect x="460" y="${H - 82}" width="80" height="24"/><rect x="488" y="${H - 72}" width="24" height="16" fill="#1a2a1a"/></g>`);
        [80, 240, 760, 920].forEach((x) => palm(x, H + 4, 1.3)); tufts(50, "#0c3a1e"); },
      crystalcaves() { out.push(`<path d="M0 0 L1000 0 L1000 70 Q900 110 820 60 Q700 120 600 70 Q480 130 380 64 Q260 120 160 70 Q80 110 0 60 Z" fill="#141a30"/>`);
        for (let i = 0; i < 9; i++) out.push(`<path d="M${60 + i * 110} ${60 + 20 * rnd()} l8 30 l8 -30 Z" fill="#2a3456"/>`);
        hills("#2a3456", 0.9, 30, H);
        for (let i = 0; i < 12; i++) crystal(40 + i * 85 + 20 * rnd(), H + 2, 0.8 + 0.8 * rnd(), ["#9ad0f8", "#c8a0f0", "#80f0d0"][i % 3]);
        flowers(40, ["#9ad0f8", "#c8a0f0"]); },
      mistyisle() { sea(H - 50, "#7a98a8"); out.push(`<g><path d="M260 ${H} Q330 ${H - 70} 420 ${H} Z" fill="#6a8a7a"/></g>`); [600, 700, 860].forEach((x) => palm(x, H + 4, 1.1));
        for (let i = 0; i < 3; i++) out.push(`<rect x="0" y="${60 + i * 34}" width="1000" height="16" fill="#fff" opacity="${0.35 - i * 0.08}"/>`); tufts(20, "#a89460"); },
      magetower() { stars(40); out.push(`<circle cx="160" cy="50" r="22" fill="#f0e8ff" opacity=".9"/>`); hills("var(--hill)", 0.9, 26, H);
        out.push(`<g><rect x="455" y="${H - 150}" width="90" height="150" fill="#5a5070"/><rect x="455" y="${H - 150}" width="90" height="10" fill="#3a3050"/>
          <path d="M440 ${H - 150} L500 ${H - 230} L560 ${H - 150} Z" fill="#6a5ad8"/><circle cx="500" cy="${H - 236}" r="7" fill="#f2c43c"/>
          ${[H - 120, H - 80, H - 40].map((y) => `<rect x="490" y="${y}" width="20" height="24" rx="10" fill="#f2e6a8" opacity=".9"/>`).join("")}<rect x="486" y="${H - 22}" width="28" height="22" fill="#2a2036"/></g>`);
        for (let i = 0; i < 12; i++) out.push(`<circle cx="${380 + 240 * rnd()}" cy="${H - 60 - 200 * rnd()}" r="${1.5 + 2 * rnd()}" fill="#c8a0f0" opacity=".8"/>`); tufts(30, "#3a3060"); },
      frostpeak() { cloud(300, 40, 1, 0.7); peaks("#9ab0c8", "#ffffff", 5, 120); hills("#dfe8f0", 0.95, 18, H);
        for (let i = 0; i < 10; i++) pine(40 + i * 100 + 30 * rnd(), H + 6, 1 + 0.4 * rnd(), "#2f5a4a", "#ffffff");
        for (let i = 0; i < 40; i++) out.push(`<circle cx="${1000 * rnd()}" cy="${320 * rnd()}" r="${1 + 1.6 * rnd()}" fill="#fff" opacity=".8"/>`); },
      // the desert and the Nile (2026-10-08) -- drawn until Cam's own pictures come
      desert() { sun(820, 50, "#fff0b0"); out.push(`<rect x="0" y="0" width="1000" height="${H}" fill="#f6c870" opacity=".25"/>`);
        [[300, 150, 110], [430, 110, 76], [180, 90, 60]].forEach(([x, w, h]) => out.push(`<path d="M${x - w} ${H} L${x} ${H - h} L${x + w} ${H} Z" fill="#d8a858"/><path d="M${x} ${H - h} L${x + w} ${H} L${x + w * 0.3} ${H} Z" fill="#b8883a"/>`));
        for (let i = 0; i < 5; i++) out.push(`<path d="M${i * 230 - 60} ${H + 4} Q${i * 230 + 60} ${H - 30 - 20 * rnd()} ${i * 230 + 180} ${H + 4} Z" fill="#e8c078"/>`);
        out.push(`<ellipse cx="780" cy="${H + 30}" rx="90" ry="16" fill="#4aa8c8"/>`); [720, 830, 870].forEach((x) => palm(x, H + 24, 0.9)); tufts(16, "#c8963c"); },
      oasis() { sun(820, 50, "#fff0b0"); out.push(`<rect x="0" y="0" width="1000" height="${H}" fill="#f6c870" opacity=".2"/>`);
        for (let i = 0; i < 5; i++) out.push(`<path d="M${i * 230 - 60} ${H + 4} Q${i * 230 + 60} ${H - 24 - 16 * rnd()} ${i * 230 + 180} ${H + 4} Z" fill="#e8c078"/>`);
        out.push(`<ellipse cx="500" cy="${H + 46}" rx="260" ry="34" fill="#3a9ac0"/><ellipse cx="470" cy="${H + 40}" rx="150" ry="12" fill="#8ad0e8" opacity=".6"/>`);
        [230, 300, 690, 760, 830].forEach((x, i) => palm(x, H + 30 + (i % 2) * 14, 1 + 0.15 * (i % 3))); tufts(18, "#7aa04a"); },
      hollowcrypt() { out.push(`<rect width="1000" height="320" fill="#1a1622"/><path d="M0 0 L1000 0 L1000 60 Q900 90 800 56 Q700 96 600 60 Q500 96 400 58 Q300 94 200 60 Q100 92 0 58 Z" fill="#2a2434"/>`);
        [180, 400, 620, 840].forEach((x) => out.push(`<path d="M${x - 60} ${H} L${x - 60} ${H - 150} Q${x} ${H - 210} ${x + 60} ${H - 150} L${x + 60} ${H} Z" fill="#3a3248"/><rect x="${x - 6}" y="${H - 120}" width="12" height="16" rx="3" fill="#f2c43c" opacity=".55"/>`));
        for (let i = 0; i < 9; i++) out.push(`<circle cx="${60 + 880 * rnd()}" cy="${H - 40 - 160 * rnd()}" r="${3 + 3 * rnd()}" fill="#bfe8ff" opacity=".55"/>`); tufts(14, "#4a4058"); },
      icecavern() { out.push(`<rect width="1000" height="320" fill="#0e2a44"/><path d="M0 0 L1000 0 L1000 80 Q880 130 760 70 Q640 140 520 76 Q400 140 280 70 Q160 130 0 70 Z" fill="#1e4a6a"/>`);
        for (let i = 0; i < 12; i++) out.push(`<path d="M${40 + i * 85} ${70 + 20 * rnd()} l10 ${40 + 30 * rnd()} l10 ${-40 - 30 * rnd()} Z" fill="#9ad8f8" opacity=".75"/>`);
        hills("#2a6a9a", 0.9, 26, H); out.push(`<ellipse cx="640" cy="${H + 60}" rx="220" ry="30" fill="#0a1a2a" opacity=".85"/>`);
        for (let i = 0; i < 10; i++) crystal(60 + i * 95 + 20 * rnd(), H + 2, 0.8 + 0.7 * rnd(), ["#9ad8f8", "#cfeeff", "#6ab8e8"][i % 3]); },
      summit() { stars(10); cloud(200, 120, 1.2, 0.8); cloud(700, 140, 1.4, 0.8); peaks("#7a90a8", "#ffffff", 3, 170);
        hills("#e8f0f6", 0.95, 14, H); out.push(`<g fill="#8a8a96">${[[480, 30], [500, 22], [492, 14]].map(([x, h]) => `<rect x="${x - 8}" y="${H - h}" width="18" height="10" rx="3"/>`).join("")}</g>`);
        for (let i = 0; i < 60; i++) out.push(`<circle cx="${1000 * rnd()}" cy="${320 * rnd()}" r="${1 + 1.6 * rnd()}" fill="#fff" opacity=".8"/>`); },
      opensea() { sun(860, 50); cloud(300, 40, 1); cloud(620, 56, 0.8); sea(110, "#2a6a9a");
        for (let i = 0; i < 40; i++) out.push(`<path d="M${1000 * rnd()} ${120 + 190 * rnd()} q8 -5 16 0" stroke="rgba(255,255,255,.55)" stroke-width="2" fill="none"/>`);
        out.push(`<g><path d="M420 ${H + 40} q30 -26 70 -8 l-10 10 q-30 -8 -60 -2 Z" fill="#2a3a4a"/><path d="M700 ${H + 20} l14 -22 l6 22 Z" fill="#3a4a5a"/>
          <path d="M230 ${H - 20} l60 0 l-10 18 l-40 0 Z" fill="#6b4a2a"/><path d="M258 ${H - 20} l0 -64 l38 54 Z" fill="#f2ece0"/>
          <path d="M800 ${H - 6} q40 -22 90 0 q-20 10 -45 8 q-25 2 -45 -8 Z" fill="#4a6a8a"/><path d="M845 ${H - 24} l-6 -16 l12 0 Z" fill="#cfe8f6" opacity=".8"/></g>`); },
      sandport() { sun(840, 46, "#fff0b0"); sea(H - 30, "#3a8ab8");
        [[120, 70], [230, 54], [360, 80], [480, 60]].forEach(([x, h]) => out.push(`<g><rect x="${x - 40}" y="${H - h}" width="80" height="${h}" fill="#e0bc80"/><rect x="${x - 44}" y="${H - h - 6}" width="88" height="8" fill="#c8963c"/><rect x="${x - 8}" y="${H - 24}" width="16" height="24" fill="#6b4a2a"/><rect x="${x - 34}" y="${H - h + 14}" width="68" height="8" fill="${["#c8402e", "#2a6ad8", "#e0a020", "#2a8a5a"][x % 4]}" opacity=".8"/></g>`));
        out.push(`<g><rect x="600" y="${H - 34}" width="220" height="10" fill="#8a6a42"/>${[620, 680, 740, 800].map((x) => `<rect x="${x}" y="${H - 26}" width="6" height="30" fill="#6b4a2a"/>`).join("")}<path d="M700 ${H - 40} l60 0 l-10 18 l-40 0 Z" fill="#6b4a2a"/><path d="M728 ${H - 40} l0 -70 l40 60 Z" fill="#f2ece0"/></g>`);
        [560, 900, 960].forEach((x) => palm(x, H + 4, 1)); tufts(14, "#c8963c"); },
      frosthaven() { cloud(300, 40, 1, 0.7); peaks("#9ab0c8", "#ffffff", 4, 100); sea(H - 30, "#5a7a9a");
        [[120, 60], [240, 74], [380, 56], [500, 66]].forEach(([x, h]) => out.push(`<g><rect x="${x - 38}" y="${H - h}" width="76" height="${h}" fill="#7a5a3a"/><path d="M${x - 46} ${H - h} L${x} ${H - h - 34} L${x + 46} ${H - h} Z" fill="#f2f6fa"/><rect x="${x + 14}" y="${H - h - 30}" width="10" height="20" fill="#5a5a64"/><rect x="${x - 10}" y="${H - 30}" width="20" height="30" fill="#3a2a1a"/><rect x="${x - 30}" y="${H - h + 16}" width="14" height="12" fill="#f2d070" opacity=".9"/></g>`));
        out.push(`<g><rect x="620" y="${H - 34}" width="220" height="10" fill="#6a5a4a"/>${[640, 700, 760, 820].map((x) => `<rect x="${x}" y="${H - 26}" width="6" height="30" fill="#4a3a2a"/>`).join("")}</g>`);
        for (let i = 0; i < 6; i++) pine(880 + i * 22, H + 6, 0.9, "#2f5a4a", "#ffffff");
        for (let i = 0; i < 40; i++) out.push(`<circle cx="${1000 * rnd()}" cy="${320 * rnd()}" r="${1 + 1.6 * rnd()}" fill="#fff" opacity=".8"/>`); },
      nile() { sun(160, 46); cloud(560, 40, 0.9); out.push(`<path d="M0 ${H + 40} Q300 ${H + 10} 520 ${H + 50} T1000 ${H + 30} L1000 ${H + 100} Q600 ${H + 80} 300 ${H + 110} T0 ${H + 90} Z" fill="#3a8ab8"/>`);
        hills("#c8b070", 0.6, 20, H); out.push(`<path d="M820 ${H} L900 ${H - 70} L980 ${H} Z" fill="#d8a858"/>`);
        for (let i = 0; i < 30; i++) { const x = 1000 * rnd(); out.push(`<path d="M${x} ${H + 50} l${-4 + 8 * rnd()} -40" stroke="#6a9a3a" stroke-width="3"/><ellipse cx="${x}" cy="${H + 10}" rx="5" ry="8" fill="#8ab04a"/>`); }
        [80, 420, 640].forEach((x) => palm(x, H + 4, 1)); flowers(20, ["#5a7ae8", "#f8a8c0"]); },
    };
    (scene[id] || scene.pasture)();
    return `<svg class="pp-scene" viewBox="0 0 1000 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${out.join("")}</svg>`;
  }
  // pages that are places in a region (2026-10-08, Cam: the Forest's camp "is also where the camp will be located")
  // a place inside another: Back steps out to it (2026-10-09)
  const REGION_UP = {nile: "desert", oasis: "desert", icecavern: "frostpeak", summit: "frostpeak", deepjungle: "jungle", hollowcrypt: "mistyisle"};
  const REGION_DOORS = {forest: [["pet:camp", "Camp", "relic", "Lasting upgrades for every pet"]],
    // the Nile is a sub-area of the Desert (2026-10-08): a way down to the river, and back up
    desert: [["pet:pyramid", "The Pyramid", "glyphsun", "Five chambers a day -- and the sarcophagus after dark"], ["@nile", "The Nile", "papyrus", "Down to the river"], ["@oasis", "The Oasis", "dates", "Palms and cool water"], ["@sandport", "Sandport", "obj_village", "Back to town and the dock"]],
    // the Oasis (2026-10-09): rest by the water, and after dark a merchant who may not be there at all
    oasis: [["rest:oasis", "Rest by the water", "lotus", "Heals you and your pets -- once every 4 hours"], ["shop:mirage", "The mirage merchant", "stardust", "After dark only (9 pm to 5 am)"],
            ["@desert", "The Desert", "sand", "Back out into the sands"]],
    nile: [["@desert", "The Desert", "sand", "Back up into the sands"]],
    // the Shipyard and the islands' towns (2026-10-08)
    coast: [["pet:shipyard", "Shipyard", "plank", "Your ship, and Shipwright Hal"]],
    opensea: [["@coast", "Back to the Coast", "boat", "Into the harbour"]],
    sandport: [["shop:bazaar", "The bazaar", "dates", "Tariq's stalls: island goods, rope, eggs"], ["rest:inn", "The inn", "heartystew", "A hot meal and a bed: 60 coins"],
               ["sail:home", "The dock", "boat", "Sail home"], ["sheet:contracts", "Nefer's contracts", "obj_map", "Goods from the other islands, for coins and crates"], ["pet:islandestate", "Your estate", "obj_house", "A home away from home"], ["@desert", "Road to the Desert", "sand", "Out into the sands"]],
    frosthaven: [["shop:tradingpost", "Trading post", "furcoat", "Astrid's furs, rope and lamps"], ["rest:inn", "The inn", "heartystew", "A hot meal and a bed: 60 coins"],
                 ["sail:home", "The dock", "boat", "Sail home"], ["sheet:contracts", "Ingrid's contracts", "obj_map", "Goods from the other islands, for coins and crates"], ["pet:islandestate", "Your estate", "obj_house", "A home away from home"], ["@frostpeak", "Path to the mountains", "climbinggear", "Up into the snow"]],
    frostpeak: [["@frosthaven", "Frosthaven", "obj_village", "Back to town and the dock"], ["@icecavern", "Ice Cavern", "frostcrystal", "Down under the ice"],
                ["@summit", "The Summit", "climbinggear", "Up to the peak"]],
    // Frostpeak's sub-areas (stage 3): the Yeti is earned in the Foothills and fought at the Summit
    icecavern: [["@frostpeak", "Back to the Foothills", "snowberries", "Out into the snow"]],
    summit: [["boss:frostpeak", "The Yeti's lair", "yetifur", "When the Foothills have had enough of you"], ["@frostpeak", "Back to the Foothills", "snowberries", "Down the mountain"]],
    // the Hollow Crypt (Battle Re-work Part 13): down from the Misty Isle; Sexton Hobb's stall
    mistyisle: [["@hollowcrypt", "Hollow Crypt", "bloodessence", "Steps down, under the Isle (bring a lantern)"]],
    hollowcrypt: [["shop:cryptmerchant", "Sexton Hobb's stall", "lifeessence", "A little life essence, dear -- three a day"], ["@mistyisle", "Back up to the Misty Isle", "boat", "Out into the fog"]]};
  function renderLand(host, id) {
    const {s, now} = current();
    const lv = Core.landView(s, id, now);
    if (!lv) { worldRegion = ""; return renderWorld(host); }
    const places = [].concat(
      lv.spots.map((sp) => ({key: sp.skill + ":" + sp.id, kind: "spot", go: "pet:" + sp.skill, skill: sp.skill, spot: sp.id, icon: itemIcon(sp.main, 32), name: sp.name, sub: `${sp.skillName} ${sp.level}`, lock: sp.lock, here: sp.here, secret: sp.secret})),
      lv.hunt ? [{key: "hunt", kind: "hunt", go: "pet:hunt", ground: lv.hunt.id, icon: monsterURL(lv.hunt.boss, 32), name: `${lv.hunt.name} hunting ground`, sub: `Combat ${lv.hunt.level} · ${lv.hunt.bossName}`, lock: lv.hunt.open ? "" : `Combat level ${lv.hunt.level}`,
                  here: lv.doing.includes("hunt"), boss: lv.bossReady}] : [],
      lv.expedition ? [{key: "exp", kind: "exp", go: "pet:expeditions", icon: itemIcon("woodcrate", 32), name: `${lv.expedition.name} expedition`, sub: `For pets, level ${lv.expedition.level}+`, lock: ""}] : [],
      (REGION_DOORS[id] || []).map(([k, name, icon, sub]) => ({key: k, kind: k.startsWith("@") ? "region" : k.startsWith("sail:") ? "sail" : k.startsWith("boss:") ? "lair" : k.startsWith("shop:") ? "shop" : k.startsWith("rest:") ? "rest" : k.startsWith("sheet:") ? "sheet" : "page", go: k, icon: itemIcon(icon, 32), name, sub, lock: ""})),
      lv.person ? [{key: "person", kind: "person", icon: avatarURL(lv.person.look, 32), name: lv.person.name, sub: lv.person.quest ? `Quest: ${lv.person.quest.name}` : "No more quests", lock: "", ready: lv.person.quest && lv.person.quest.can}] : []);
    const pins = places.map((p, i) => {
      const n = places.length, rows = n > 8 ? 3 : n > 3 ? 2 : 1, cols = Math.ceil(n / rows), row = i % rows, col = Math.floor(i / rows);
      const x = 8 + (84 * (col + 0.5 + (row % 2 ? 0.35 : 0))) / cols, y = 42 + row * (rows === 3 ? 19 : 24);
      return `<button class="pp-pin${p.lock ? " locked" : ""}${p.here ? " here" : ""}${p.kind === "person" ? " person" : ""}${p.ready ? " ready" : ""}" style="left:${x}%;top:${y}%" data-i="${i}" title="${esc(p.name)}${p.lock ? " — " + esc(p.lock) : ""}">
        <img alt="" src="${p.icon}"><span>${esc(p.name)}</span></button>`;
    }).join("");
    const ex = lv.exploring, allFound = lv.found >= lv.total;
    // Cam's picture of the region, when there is one (2026-10-08) -- the drawn scene and pins otherwise
    const painted = SCENE_ART[id] && !modPics.regions[id];
    const paintedPlaces = places.map((p) => Object.assign({}, p, {lockShort: p.kind === "spot" || p.kind === "hunt" ? p.sub.replace(/ ·.*/, "") : "",
      hereText: p.kind === "hunt" ? "Hunting here" : "You're here"}))
      .concat(lv.hunt ? [{key: "boss", name: lv.hunt.bossName, lock: lv.bossReady ? "" : "win more hunts here first", lockShort: "Not yet", note: lv.bossReady ? "Fight " + lv.hunt.bossName : ""}] : [])
      .concat(lv.tower ? lv.tower.ranks.filter((r) => r.n).map((r) => ({key: "rank:" + r.n, name: r.name, lock: r.done || r.next ? "" : "a rank at a time", lockShort: "Later",
        note: r.done ? "✓ Yours" : r.next ? (r.ready ? "Duel" : "Not ready yet") : ""})) : []);
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${painted ? `<div class="pp-land-painted">${paintedHTML(id, lv.open ? paintedPlaces : [])}${lv.open ? "" : `<div class="pp-land-locked">🔒 ${esc(lv.lock)}</div>`}</div>`
          : `<div class="pp-arena pp-land arena-${esc(id)}">
          ${sceneSVG(id)}
          <div class="pp-land-title"><b>${esc(lv.name)}</b></div>
          ${lv.open ? pins : `<div class="pp-land-locked">🔒 ${esc(lv.lock)}</div>`}
        </div>`}
        ${lv.job && lv.doing.some((k) => k === "gather" || k === "hunt") ? `<div class="pp-land-now">
            <div class="pp-land-trip" id="pp-land-trip">${landTripHTML(lv, s, now)}</div>
            ${lv.job.hunt ? `<button class="btn btn-sm" data-jump="pet:hunt">Watch</button>` : ""}
            <button class="btn btn-sm" id="pp-land-home">Come home</button></div>` : ""}
        ${painted ? `<div class="pp-land-bar">
            ${ex ? `<span>Out exploring — back in <b id="pp-explore-clock">${clock(ex.endsIn)}</b></span>`
              : `<button class="btn btn-primary" id="pp-explore" ${lv.busy || !lv.open ? "disabled" : ""} title="${esc(lv.busy || `${Math.round(lv.chance * 100)}% chance of finding something hidden`)}">Explore (${Math.round(lv.time / 60)} min)</button>`}
            <button class="btn" id="pp-secrets">Secrets ${lv.found}/${lv.total}</button>
            ${lv.hunt && lv.bossReady && lv.open ? `<button class="btn btn-primary pp-place-card boss" data-ground="${lv.hunt.id}">Fight ${esc(lv.hunt.bossName)}</button>` : ""}
          </div>` : ""}
        <section class="pp-shop pp-explore"${lv.tower || painted || !lv.total ? " hidden" : ""}>
          <div><b>Explore the ${esc(lv.name)}</b>
            <span class="stamp">${lv.found}/${lv.total} secrets found${lv.explored ? ` · explored ${lv.explored}×` : ""}</span></div>
          ${ex ? `<p>Out exploring — back in <b id="pp-explore-clock">${clock(ex.endsIn)}</b>.</p>`
            : `<p class="stamp">${allFound ? "You've found everything hidden here — exploring still turns up a few things from around." :
                `Half an hour out. ${Math.round(lv.chance * 100)}% chance of finding something hidden — better every time you come back empty-handed, and a fox, dog, wolf, mole or hare at your side sniffs things out.`}</p>
              <button class="btn btn-primary" id="pp-explore" ${lv.busy ? "disabled" : ""}>Explore (${Math.round(lv.time / 60)} min)</button>
              ${lv.busy ? `<span class="stamp">${esc(lv.busy)}</span>` : ""}`}
        </section>
        ${lv.person && !painted ? personHTML(lv.person, lv.open) : ""}
        ${lv.tower ? `<section class="pp-shop pp-tower">
            <b>The mage tower</b> <span class="stamp">· you're ${esc(lv.tower.rankName === "Archmage" ? "the Archmage" : "a " + lv.tower.rankName)}</span>
            
            ${lv.tower.ranks.filter((r) => r.n).map((r) => `<div class="pp-recipe${r.done ? "" : r.next ? "" : " short"}">
                <img alt="" src="${monsterURL(r.duel, 32)}">
                <div class="pp-recipe-main"><div><b>${esc(r.name)}</b> <span class="stamp">· duel ${esc(r.mage)}${r.done ? " · ✓ yours" : ""}</span></div>
                  <div class="pp-needs">${r.needs.map((n) => `<span class="pp-need-chip${n.have >= n.need ? "" : " lack"}">${esc(n.skill)} ${n.have}/${n.need}</span>`).join("")}</div></div>
                ${r.next ? `<button class="btn btn-sm ${r.ready ? "btn-primary" : ""} pp-duel" ${r.ready ? "" : "disabled"}>Duel</button>`
                  : r.done ? `<button class="btn btn-sm pp-rematch" data-rematch="${r.n}" title="A practice duel: Magic xp and ${esc(r.rematch)}">Rematch</button>` : "<span></span>"}
              </div>`).join("")}
          </section>` : ""}
        ${lv.tower ? necroOfferHTML(s, now) : ""}
        <section class="pp-shop"${lv.tower || painted ? " hidden" : ""}>
          <b>Places</b>
          ${places.length ? `<div class="pp-village pp-places">${places.map((p, i) => {
            // Cam (2026-10-07): "the places ... to be the cards displayed other places. But just make them simple
            // without the list of what is there" -- an icon, a name, its level, and what a click does
            const line = p.lock ? `🔒 ${p.lock}` : p.here ? (p.kind === "hunt" ? "You're hunting here" : "You're here")
              : p.kind === "page" || p.kind === "shop" || p.kind === "sheet" ? "Go in" : p.kind === "rest" ? "Rest" : p.kind === "region" ? "Go there" : p.kind === "sail" ? "Set sail" : p.kind === "lair" ? "Fight" : p.kind === "spot" ? "Gather here" : p.kind === "hunt" ? "Hunt here" : p.kind === "exp" ? "Send a pet" : p.kind === "person" ? (p.ready ? "❗ A quest is ready" : "Talk") : "";
            return `<button class="pp-villager pp-place-card${p.lock ? " locked" : ""}${p.here ? " here" : ""}${p.kind === "person" ? " person" : ""}" data-i="${i}" ${lv.open ? "" : "disabled"}>
              <img alt="" src="${p.icon}">
              <b>${esc(p.name)}</b>
              <span class="stamp">${esc(p.kind === "person" ? "Lives here" : p.sub)}${p.secret ? " · found" : ""}</span>
              <span class="stamp pp-place-line">${esc(line)}</span></button>`;
          }).join("")}
          ${lv.hunt && lv.bossReady && lv.open ? `<button class="pp-villager pp-place-card boss" data-ground="${lv.hunt.id}">
              <img alt="" src="${monsterURL(lv.hunt.boss, 48)}"><b>${esc(lv.hunt.bossName)}</b><span class="stamp">The boss</span><span class="stamp pp-place-line">Fight</span></button>` : ""}
          </div>` : `<p class="stamp">Nothing here yet but vines.</p>`}
        </section>
        <section class="pp-shop"${lv.tower || painted || !lv.total ? " hidden" : ""}>
          <b>Secrets</b>
          <div class="pp-beasts">${lv.secrets.map((x) => x.found ? `<div class="pp-beast"><div><b>${x.kind === "egg" ? "🥚" : x.kind === "spot" ? "📍" : "💰"} ${esc(x.name)}</b></div>
              <div class="stamp">${esc(x.text)}</div></div>` : `<div class="pp-beast unknown"><b>???</b><div class="stamp">Still hidden</div></div>`).join("")}</div>
        </section>
      </div>`;
    const visit = (i) => { const p = places[i]; if (!p || !lv.open) return;
      if (p.kind === "person") { if (painted) return openPlace("person", id); const el = host.querySelector("#pp-person"); if (el) el.scrollIntoView({block: "center", behavior: "smooth"}); return; }
      if (p.ground && typeof openAreas !== "undefined") openAreas.add(p.ground); goTo(p.go); };
    // the region is where you do things now (2026-10-07): a pin or Gather starts a trip, Hunt here a hunt
    const doIt = async (i) => {
      const p = places[i];
      if (!p || !lv.open) return;
      if (p.kind === "page") return goTo(p.go);
      if (p.kind === "shop") {                                         // the mirage merchant, at the Oasis after dark
        const w = Core.villageView(s, now).find((x) => x.id === p.go.slice(5));
        if (!w) return toast(`${Core.WORKSHOPS[p.go.slice(5)].who} isn't here -- ${p.sub.toLowerCase()}.`, true);
        openShop = w.id; return showShop();
      }
      if (p.kind === "rest") { const r = await (p.go === "rest:inn" ? act("inn", {town: id}) : act("oasisrest")); if (r && r.error) { status = r.error; toast(r.error, true); render(); } return; }
      if (p.kind === "sheet") return openPlace(p.go.slice(6), id);
      if (p.kind === "region") { worldRegion = p.go.slice(1); status = ""; return render(); }
      if (p.kind === "lair") return fightBoss(p.go.slice(5));
      if (p.kind === "sail") { const r = await act("sail", {to: p.go.slice(5)}); if (r && r.error) { status = r.error; toast(r.error, true); render(); } else { worldRegion = ""; render(); } return; }
      // Cam (2026-10-08): a second click mustn't open the old skill page -- say so instead
      if (p.kind === "spot" && p.lock) return toast(`${p.name}: ${p.lock}`, true);
      // Cam (PT3, 2026-10-15): a hunting ground above your level says so -- it doesn't open the battle screen of the last one
      if (p.kind === "hunt" && p.lock) return toast(`${p.name}: needs ${p.lock.charAt(0).toLowerCase() + p.lock.slice(1)} -- you're combat level ${Core.combatLevel(s.player)}.`, true);
      if (p.kind === "spot" && p.here) return toast(`You're already gathering at the ${p.name}. "Come home" stops.`);
      if (p.kind === "person" || p.kind === "exp" || p.lock || p.here) return visit(i);
      const r = p.kind === "spot" ? await act("trip", {skill: p.skill, spot: p.spot, roll: Math.random()})
        : await act("hunt", {ground: p.ground, roll: Math.random()});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
      else if (p.kind === "hunt") { if (typeof openAreas !== "undefined") openAreas.add(p.ground); goTo("pet:hunt"); }   // straight to the fight (2026-10-20, Cam: "you cant really idle hunt anymore")
    };
    host.querySelectorAll(".pp-pin, .pp-place-card[data-i]").forEach((b) => b.addEventListener("click", () => doIt(+b.dataset.i)));
    const fightBoss = async (ground) => {
      const r = await act("boss", {ground, roll: Math.random()});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); } else goTo("pet:hunt");
    };
    host.querySelectorAll(".pp-place-card.boss").forEach((b) => b.addEventListener("click", () => fightBoss(b.dataset.ground)));
    if (painted) wirePainted(host, (key) => {
      if (key.startsWith("rank:")) {                                   // the mage tower: a floor's rank
        const r = lv.tower.ranks.find((x) => x.n === +key.slice(5));
        if (r && r.next && r.ready) { const d = host.querySelector(".pp-duel"); if (d) d.click(); return; }
        if (r && r.done) return rematchDuel(r.n);                      // a floor you've won: a practice duel (PT19 b5)
        return toast(r ? (r.done ? `${r.name}: that rank is yours.` : r.next ? `${r.name}: ` + r.needs.filter((n) => n.have < n.need).map((n) => `${n.skill} ${n.need}`).join(", ") + " first." : `${r.name}: win the ranks below first.`) : "", !r || !r.done);
      }
      if (key === "boss") { if (lv.bossReady) fightBoss(lv.hunt.id); else toast(`${lv.hunt.bossName} won't come out yet -- win more hunts here first.`, true); return; }
      const i = places.findIndex((p) => p.key === key);
      if (i >= 0) doIt(i);
    });
    const lh = host.querySelector("#pp-land-home");
    if (lh) lh.addEventListener("click", () => act("home"));
    host.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.jump)));
    host.querySelectorAll(".pp-rematch").forEach((b) => b.addEventListener("click", () => rematchDuel(+b.dataset.rematch)));
    host.querySelectorAll(".pp-duel").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("rank", {roll: Math.random(), manual: bossMode && bossMode() === "manual"});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); } else goTo("pet:hunt");
    }));
    const qb = host.querySelector("#pp-quest");
    if (qb) qb.addEventListener("click", async () => {
      const had = !!((current().s.quests || {}).quarry);
      const r = await act("quest", {region: id});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
      else if (!had && (current().s.quests || {}).quarry) talkPopup("quarry");   // Ranger Ash explains the Bestiary (PT20 b1)
    });
    const sb = host.querySelector("#pp-secrets"); if (sb) sb.addEventListener("click", () => openPlace("secrets", id));
    if (painted) showSec();
    const exb = host.querySelector("#pp-explore");
    if (exb) exb.addEventListener("click", async () => {
      const r = await act("explore", {region: id, roll: Math.random()});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
    });
    if (ex) exploreClock(host);
    if (lv.job && lv.doing.some((k) => k === "gather" || k === "hunt")) landTripClock(host, id);
    if (lv.tower) wireNecro(host);                                      // the Archmage's offer (Part 13)
  }

  // Cam (PT15 n1): "after beating a mage at the mage tower it should exit the battle screen then a pop up with some dialog from the
  // defeated mage, saying something along the lines of your training is paying off. The Dialogue should fit the mage rank." --
  // the battle screen hands a won duel here once the mage has fallen: back to the tower, and the mage's words (MAGE_RANKS beaten).
  const duelsSaid = new Set();
  function towerWords(lb, now) {
    if (!lb || !lb.duel || !lb.won || duelsSaid.has(lb.at) || now - lb.at < 1800 || now - lb.at > 60000) return false;
    duelsSaid.add(lb.at);
    const n = typeof lb.rank === "number" ? lb.rank : Core.MAGE_RANKS.findIndex((r) => r.duel === lb.mon), rk = Core.MAGE_RANKS[n];
    if (!rk || !rk.beaten) return false;
    worldRegion = "magetower"; seaChart = false; goTo("pet:world");
    const top = n === Core.MAGE_RANKS.length - 1, offerHere = n === (Core.NECRO.offerRank || Core.MAGE_RANKS.length - 1);
    const nv = offerHere && !lb.rematch ? Core.necroView(current().s, now) : null;
    const runes = Object.keys(lb.got || {}).map((k) => `${lb.got[k]} × ${esc(Core.ITEMS[k].name.toLowerCase())}`).join(", ");
    const box = document.createElement("div");
    box.className = "pp-modal";
    box.innerHTML = `<div class="pp-modal-card pp-mage-words" role="dialog" aria-label="${esc(Core.MONSTERS[lb.mon].name)}">
        <img class="pp-mage-pic" alt="" src="${monsterURL(lb.mon, 96)}">
        <div class="pp-label">${esc(Core.MONSTERS[lb.mon].name)}</div>
        ${lb.rematch ? `<p class="pp-said">${esc(rk.again)}</p><p class="stamp">A practice duel: Magic xp${runes ? " and " + runes : ""}.</p>`
          : `<p class="pp-said">${esc(rk.beaten)}</p>
        ${nv && nv.offered && !nv.taught && !nv.accepted ? `<p class="pp-said">${esc(nv.offer)}</p><p class="stamp">Answer her on the tower page -- yes, or no for now.</p>` : `<p class="pp-said">${esc(rk.again)}</p>`}
        <p class="stamp">You're ${top ? "the Archmage" : (/^[AEIOU]/.test(rk.name) ? "an " : "a ") + esc(rk.name)} of the mage tower now.</p>`}
        <div class="pp-row"><button class="btn pp-mage-again">Rematch</button><button class="btn btn-primary pp-modal-close">Close</button></div></div>`;
    document.body.appendChild(box);
    const shut = () => box.remove();
    box.querySelector(".pp-modal-close").addEventListener("click", shut);
    box.querySelector(".pp-mage-again").addEventListener("click", () => { shut(); rematchDuel(n); });
    box.addEventListener("click", (e) => { if (e.target === box) shut(); });
    box.querySelector(".pp-modal-close").focus();
    return true;
  }
  /** A practice duel with a mage you've beaten (PT19 b5). */
  async function rematchDuel(n) {
    const r = await act("rank", {rematch: n, roll: Math.random(), manual: typeof bossMode === "function" && bossMode() === "manual"});
    if (r && r.error) { status = r.error; toast(r.error, true); render(); } else goTo("pet:hunt");
  }
