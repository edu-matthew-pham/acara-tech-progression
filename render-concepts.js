// render-concepts.js
// Generic concept dependency tree renderer.
// Reads level_key from each standard — no subject-specific code parsing.
// Configure via window.CONCEPTS_CONFIG before this script loads.
//
// window.CONCEPTS_CONFIG = {
//   dataUrl:      './science_y_goals_map.json',   // JSON file to fetch
//   levelOrder:   ["F","1","2","3","4","5","6","7","8","9","10"], // ordered level keys
//   levelLabels:  { "F": "F", "1": "Y1", ... },  // display labels
//   strandConfig: { biological: { color, cssKey }, ... },
//   strandOrder:  ["biological", ...],
//   goalField:    "y_goal",                        // field name for tooltip goal text
//   svgId:        "tree-svg-concepts",
//   controlsId:   "strand-controls-concepts",
//   rowsPerStrand: 2,  // optional, default 2. Set to 4 for dense strands like Maths.
// }

(function () {
  const CFG = window.CONCEPTS_CONFIG || {};

  const NODE_W          = 110;
  const NODE_H          = 56;
  const COL_W           = CFG.colWidth || 130;
  const ROW_H           = 72;
  const STRAND_GAP      = 24;
  const ROWS_PER_STRAND = CFG.rowsPerStrand || 2;
  const BAND_H          = ROWS_PER_STRAND * ROW_H;
  const HEADER_H        = 48;
  const START_X         = 110;
  const LABEL_X         = 16;

  const LEVEL_ORDER  = CFG.levelOrder  || [];
  const LEVEL_LABELS = CFG.levelLabels || {};
  const STRAND_CONFIG = CFG.strandConfig || {};
  const STRAND_ORDER  = CFG.strandOrder  || [];
  const GOAL_FIELD    = CFG.goalField    || "y_goal";
  const SVG_ID        = CFG.svgId        || "tree-svg-concepts";
  const CTRL_ID       = CFG.controlsId   || "strand-controls-concepts";
  const DATA_URL      = CFG.dataUrl      || "./concept_map.json";

  const LEVEL_X = {};
  LEVEL_ORDER.forEach((l, i) => { LEVEL_X[l] = START_X + i * COL_W; });
  const SVG_W = START_X + LEVEL_ORDER.length * COL_W + 20;

  function getMeta(code, yearLevels) {
    for (const lvl of Object.values(yearLevels)) {
      const std = lvl.standards.find(s => s.code === code);
      if (std) return std;
    }
    return null;
  }

  function getLevelKey(code, yearLevels) {
    for (const lvl of Object.values(yearLevels)) {
      const std = lvl.standards.find(s => s.code === code);
      if (std) return std.level_key;
    }
    return null;
  }

  function wrapTitle(title, maxChars) {
    const words = title.split(" ");
    const lines = [];
    let current = "";
    words.forEach(w => {
      const candidate = current ? current + " " + w : w;
      if (candidate.length <= maxChars) { current = candidate; }
      else { if (current) lines.push(current); current = w; }
    });
    if (current) lines.push(current);
    return lines;
  }

  function elbowPath(ax, ay, bx, by) {
    const x1 = ax + NODE_W/2, x2 = bx - NODE_W/2;
    const gapX = x1 + (x2 - x1)/2, r = 6;
    if (Math.abs(ay - by) < 4) return `M${x1},${ay} L${x2},${by}`;
    const vDir = by > ay ? 1 : -1;
    return [`M${x1},${ay}`,`L${gapX-r},${ay}`,`Q${gapX},${ay} ${gapX},${ay+vDir*r}`,
            `L${gapX},${by-vDir*r}`,`Q${gapX},${by} ${gapX+r},${by}`,`L${x2},${by}`].join(" ");
  }

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }

  const tip = document.getElementById("tooltip");
  function showTip(e, code, meta, color) {
    document.getElementById("tt-code").textContent  = code;
    document.getElementById("tt-code").style.color  = color;
    document.getElementById("tt-title").textContent = meta ? meta.title : code;
    document.getElementById("tt-goal").textContent  = meta ? (meta[GOAL_FIELD] || "(no goal found)") : "(no goal found)";
    tip.classList.add("show"); moveTip(e);
  }
  function moveTip(e) {
    tip.style.left = Math.min(e.clientX + 16, window.innerWidth - 320) + "px";
    tip.style.top  = Math.max(10, e.clientY - 10) + "px";
  }
  function hideTip() { tip.classList.remove("show"); }

  const activeStrands = new Set(STRAND_ORDER);

  function render(data) {
    const yearLevels = data.year_levels;
    const strands    = data.progression_threads.strands;

    const strandBandY = {};
    let y = HEADER_H;
    STRAND_ORDER.forEach(key => {
      if (!activeStrands.has(key)) return;
      strandBandY[key] = y;
      y += BAND_H + STRAND_GAP;
    });

    const SVG_H = y + 16;
    const svg   = document.getElementById(SVG_ID);
    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${SVG_W} ${SVG_H}`);
    svg.setAttribute("width", SVG_W);
    svg.setAttribute("height", SVG_H);

    // Active levels
    const activeLevels = new Set();
    STRAND_ORDER.forEach(key => {
      if (!activeStrands.has(key) || !strands[key]) return;
      function collect(node) {
        const lk = getLevelKey(node.code, yearLevels);
        if (lk) activeLevels.add(lk);
        node.children.forEach(collect);
      }
      strands[key].tree.forEach(collect);
    });

    // Column headers
    LEVEL_ORDER.forEach(lk => {
      const x = LEVEL_X[lk], hasNodes = activeLevels.has(lk);
      svgEl("line", { x1:x, y1:HEADER_H-8, x2:x, y2:SVG_H-16,
        stroke: hasNodes?"#ddd":"#eee", "stroke-width":"1", "stroke-dasharray":"3 4" }, svg);
      const lbl = svgEl("text", { x, y:28, "text-anchor":"middle",
        "font-size":"12", "font-weight": hasNodes?"600":"400",
        fill: hasNodes?"#444":"#ccc", "font-family":"system-ui,sans-serif" }, svg);
      lbl.textContent = LEVEL_LABELS[lk] || lk;
    });

    // Strands
    STRAND_ORDER.forEach(key => {
      if (!activeStrands.has(key) || !strands[key]) return;
      const strand = strands[key], cfg = STRAND_CONFIG[key];
      const color = cfg.color, bandY = strandBandY[key];

      const nodeSet = new Set(), edges = [];
      function walk(node, parent) {
        nodeSet.add(node.code);
        if (parent) edges.push([parent, node.code]);
        node.children.forEach(c => walk(c, node.code));
      }
      strand.tree.forEach(root => walk(root, null));

      // Bucket by level
      const levelBuckets = {};
      nodeSet.forEach(code => {
        const lk = getLevelKey(code, yearLevels);
        if (!lk) return;
        if (!levelBuckets[lk]) levelBuckets[lk] = [];
        if (!levelBuckets[lk].includes(code)) levelBuckets[lk].push(code);
      });

      const nodePos = {};
      Object.entries(levelBuckets).forEach(([lk, codes]) => {
        const x = LEVEL_X[lk];
        if (!x) return;
        codes.forEach((code, i) => {
          nodePos[code] = { x, y: bandY + Math.min(i, ROWS_PER_STRAND-1) * ROW_H + NODE_H/2 + 4 };
        });
      });

      // Strand label
      const midBandY = bandY + BAND_H/2;
      const lbl = svgEl("text", { x:LABEL_X, y:midBandY, "text-anchor":"middle",
        "dominant-baseline":"central", "font-size":"10", "font-weight":"600",
        fill:color, "font-family":"system-ui,sans-serif",
        transform:`rotate(-90,${LABEL_X},${midBandY})` }, svg);
      lbl.textContent = strand.label;

      svgEl("rect", { x:LABEL_X+10, y:bandY, width:SVG_W-LABEL_X-10, height:BAND_H,
        fill:color, opacity:"0.04", rx:"6" }, svg);

      // Edges
      edges.forEach(([from, to]) => {
        const a = nodePos[from], b = nodePos[to]; if (!a || !b) return;
        svgEl("path", { d:elbowPath(a.x,a.y,b.x,b.y), fill:"none",
          stroke:color, "stroke-width":"1.5", opacity:"0.5" }, svg);
      });

      // Nodes
      nodeSet.forEach(code => {
        const pos = nodePos[code]; if (!pos) return;
        const meta = getMeta(code, yearLevels);
        const lines = wrapTitle(meta ? meta.title : code, 13);
        const g = svgEl("g", { style:"cursor:pointer" }, svg);
        const rx = pos.x - NODE_W/2, ry = pos.y - NODE_H/2;
        svgEl("rect", { x:rx+2, y:ry+2, width:NODE_W, height:NODE_H, rx:"10", fill:"rgba(0,0,0,0.07)" }, g);
        svgEl("rect", { x:rx, y:ry, width:NODE_W, height:NODE_H, rx:"10", fill:color, stroke:"#fff", "stroke-width":"2" }, g);
        const lH=13, tH=lines.length*lH, sY=pos.y-tH/2+lH/2;
        lines.forEach((line, i) => {
          const t = svgEl("text", { x:pos.x, y:sY+i*lH, "text-anchor":"middle",
            "dominant-baseline":"central", "font-size":"10", "font-weight":"500",
            fill:"#fff", "font-family":"system-ui,sans-serif" }, g);
          t.textContent = line;
        });
        g.addEventListener("mouseenter", e => showTip(e, code, meta, color));
        g.addEventListener("mousemove", moveTip);
        g.addEventListener("mouseleave", hideTip);
      });
    });
  }

  function buildButtons(data) {
    const strands = data.progression_threads.strands;

    function updateButtons() {
      const allOn = STRAND_ORDER.every(k => activeStrands.has(k));
      document.getElementById("btn-c-all").classList.toggle("active-all", allOn);
      STRAND_ORDER.forEach(key => {
        const btn = document.getElementById(`btn-c-${key}`);
        if (btn) btn.classList.toggle(`active-${STRAND_CONFIG[key].cssKey}`, activeStrands.has(key));
      });
    }

    const ctrl = document.getElementById(CTRL_ID);
    const allBtn = document.createElement("button");
    allBtn.id = "btn-c-all"; allBtn.className = "strand-btn active-all"; allBtn.textContent = "All";
    allBtn.onclick = () => {
      const allOn = STRAND_ORDER.every(k => activeStrands.has(k));
      if (allOn) activeStrands.clear(); else STRAND_ORDER.forEach(k => activeStrands.add(k));
      updateButtons(); render(data);
    };
    ctrl.appendChild(allBtn);

    const sep = document.createElement("span");
    sep.style.cssText = "width:1px;background:#ddd;margin:0 4px;align-self:stretch;display:inline-block";
    ctrl.appendChild(sep);

    STRAND_ORDER.forEach(key => {
      if (!strands[key]) return;
      const cfg = STRAND_CONFIG[key];
      const btn = document.createElement("button");
      btn.id = `btn-c-${key}`; btn.className = `strand-btn active-${cfg.cssKey}`;
      btn.textContent = strands[key].label;
      btn.onclick = () => {
        if (activeStrands.has(key)) activeStrands.delete(key); else activeStrands.add(key);
        updateButtons(); render(data);
      };
      ctrl.appendChild(btn);
    });
  }

  fetch(DATA_URL)
    .then(r => r.json())
    .then(data => { buildButtons(data); render(data); })
    .catch(err => {
      document.getElementById(SVG_ID).innerHTML =
        `<text x="20" y="40" font-size="13" fill="#c00">Failed to load data: ${err.message}</text>`;
    });
})();