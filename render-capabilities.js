// render-capabilities.js
// Generic capability swim-lane renderer.
// Reads level_key from each standard — no subject-specific code parsing.
// Configure via window.CAPABILITIES_CONFIG before this script loads.
//
// window.CAPABILITIES_CONFIG = {
//   dataUrl:     './science_capability_map.json',
//   bandOrder:   ["F", "1-2", "3-4", "5-6", "7-8", "9-10"],
//   bandLabels:  { "F": "F", "1-2": "Y1-2", ... },
//   strandConfig: { human_endeavour: { color, cssKey, label }, ... },
//   strandOrder:  ["human_endeavour", "inquiry"],
//   goalField:   "capability_goal",
//   svgId:       "tree-svg-capabilities",
//   controlsId:  "strand-controls-capabilities",
// }

(function () {
  const CFG = window.CAPABILITIES_CONFIG || {};

  const NODE_W        = 110;
  const NODE_H        = 56;
  const COL_W         = CFG.colWidth || 150;
  const ROW_H         = 72;
  const ROWS_PER_LANE = 2;
  const LANE_H        = ROWS_PER_LANE * ROW_H;
  const LANE_GAP      = 16;
  const HEADER_H      = 48;
  const START_X       = 150;
  const LABEL_X       = 16;

  const BAND_ORDER   = CFG.bandOrder   || [];
  const BAND_LABELS  = CFG.bandLabels  || {};
  const STRAND_CONFIG = CFG.strandConfig || {};
  const STRAND_ORDER  = CFG.strandOrder  || [];
  const GOAL_FIELD    = CFG.goalField    || "capability_goal";
  const SVG_ID        = CFG.svgId        || "tree-svg-capabilities";
  const CTRL_ID       = CFG.controlsId   || "strand-controls-capabilities";
  const DATA_URL      = CFG.dataUrl      || "./capability_map.json";

  const BAND_X = {};
  BAND_ORDER.forEach((b, i) => { BAND_X[b] = START_X + i * COL_W; });
  const SVG_W = START_X + BAND_ORDER.length * COL_W + 20;

  function getMeta(code, levels) {
    for (const lvl of Object.values(levels)) {
      const std = lvl.standards.find(s => s.code === code);
      if (std) return std;
    }
    return null;
  }

  function getLevelKey(code, levels) {
    for (const lvl of Object.values(levels)) {
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

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }

  function showTip(e, code, meta, color) {
    const tip = document.getElementById("tooltip");
    document.getElementById("tt-code").textContent  = code;
    document.getElementById("tt-code").style.color  = color;
    document.getElementById("tt-title").textContent = meta ? meta.title : code;
    document.getElementById("tt-goal").textContent  = meta ? (meta[GOAL_FIELD] || "(no goal found)") : "(no goal found)";
    tip.classList.add("show"); moveTip(e);
  }
  function moveTip(e) {
    const tip = document.getElementById("tooltip");
    tip.style.left = Math.min(e.clientX + 16, window.innerWidth - 320) + "px";
    tip.style.top  = Math.max(10, e.clientY - 10) + "px";
  }
  function hideTip() { document.getElementById("tooltip").classList.remove("show"); }

  const activeSubStrands = new Set();

  function render(data) {
    const levels  = data.levels;
    const strands = data.capability_threads.strands;
    const svg     = document.getElementById(SVG_ID);
    svg.innerHTML = "";

    const lanes = [];
    STRAND_ORDER.forEach(strandKey => {
      if (!strands[strandKey]) return;
      const strand = strands[strandKey];
      const strandColor = STRAND_CONFIG[strandKey] ? STRAND_CONFIG[strandKey].color : "#888";
      Object.entries(strand.sub_strands).forEach(([subKey, sub]) => {
        const laneKey = `${strandKey}/${subKey}`;
        if (!activeSubStrands.has(laneKey)) return;
        lanes.push({ strandKey, subKey, laneKey, sub, color: sub.color || strandColor, strandColor });
      });
    });

    if (lanes.length === 0) {
      svg.setAttribute("viewBox", "0 0 400 60");
      svg.setAttribute("width", 400); svg.setAttribute("height", 60);
      const t = svgEl("text", { x:"20", y:"36", "font-size":"13", fill:"#888", "font-family":"system-ui,sans-serif" }, svg);
      t.textContent = "No sub-strands selected.";
      return;
    }

    const SVG_H = HEADER_H + lanes.length * (LANE_H + LANE_GAP) + 16;
    svg.setAttribute("viewBox", `0 0 ${SVG_W} ${SVG_H}`);
    svg.setAttribute("width", SVG_W);
    svg.setAttribute("height", SVG_H);

    // Band headers
    BAND_ORDER.forEach(band => {
      const x = BAND_X[band];
      svgEl("line", { x1:x, y1:HEADER_H-8, x2:x, y2:SVG_H-16,
        stroke:"#e8e8e6", "stroke-width":"1", "stroke-dasharray":"3 4" }, svg);
      const lbl = svgEl("text", { x, y:28, "text-anchor":"middle",
        "font-size":"12", "font-weight":"500", fill:"#888",
        "font-family":"system-ui,sans-serif" }, svg);
      lbl.textContent = BAND_LABELS[band] || band;
    });

    lanes.forEach(({ sub, color, strandColor }, laneIndex) => {
      const laneY    = HEADER_H + laneIndex * (LANE_H + LANE_GAP);
      const midLaneY = laneY + LANE_H / 2;

      svgEl("rect", { x:LABEL_X+10, y:laneY+4, width:SVG_W-LABEL_X-10, height:LANE_H-8,
        fill:color, opacity:"0.05", rx:"6" }, svg);

      const lbl = svgEl("text", { x:LABEL_X, y:midLaneY, "text-anchor":"middle",
        "dominant-baseline":"central", "font-size":"10", "font-weight":"600",
        fill:strandColor, "font-family":"system-ui,sans-serif",
        transform:`rotate(-90,${LABEL_X},${midLaneY})` }, svg);
      lbl.textContent = sub.short_label || sub.label;

      // Bucket codes by level_key — up to 2 per column
      const bandBuckets = {};
      sub.sequence.forEach(code => {
        const lk = getLevelKey(code, levels);
        if (!lk || !BAND_X[lk]) return;
        if (!bandBuckets[lk]) bandBuckets[lk] = [];
        bandBuckets[lk].push(code);
      });

      const nodePos = {};
      Object.entries(bandBuckets).forEach(([lk, codes]) => {
        const x = BAND_X[lk];
        codes.forEach((code, i) => {
          const row = Math.min(i, ROWS_PER_LANE - 1);
          nodePos[code] = { x, y: laneY + row * ROW_H + NODE_H/2 + 4 };
        });
      });

      // Connectors
      let prevPos = null;
      sub.sequence.forEach(code => {
        const pos = nodePos[code]; if (!pos) return;
        if (prevPos) {
          const x1 = prevPos.x + NODE_W/2, x2 = pos.x - NODE_W/2;
          const gapX = x1 + (x2 - x1)/2, r = 6;
          let d;
          if (Math.abs(prevPos.y - pos.y) < 4) {
            d = `M${x1},${prevPos.y} L${x2},${pos.y}`;
          } else {
            const vDir = pos.y > prevPos.y ? 1 : -1;
            d = [`M${x1},${prevPos.y}`,`L${gapX-r},${prevPos.y}`,
                 `Q${gapX},${prevPos.y} ${gapX},${prevPos.y+vDir*r}`,
                 `L${gapX},${pos.y-vDir*r}`,
                 `Q${gapX},${pos.y} ${gapX+r},${pos.y}`,
                 `L${x2},${pos.y}`].join(" ");
          }
          svgEl("path", { d, fill:"none", stroke:color, "stroke-width":"1.5", opacity:"0.4" }, svg);
        }
        prevPos = pos;
      });

      // Nodes
      sub.sequence.forEach(code => {
        const pos = nodePos[code]; if (!pos) return;
        const meta  = getMeta(code, levels);
        const lines = wrapTitle(meta ? meta.title : code, 13);
        const g  = svgEl("g", { style:"cursor:pointer" }, svg);
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
        g.addEventListener("mousemove",  moveTip);
        g.addEventListener("mouseleave", hideTip);
      });
    });
  }

  function buildButtons(data) {
    const strands = data.capability_threads.strands;

    STRAND_ORDER.forEach(strandKey => {
      if (!strands[strandKey]) return;
      Object.keys(strands[strandKey].sub_strands).forEach(subKey => {
        activeSubStrands.add(`${strandKey}/${subKey}`);
      });
    });

    function updateButtons() {
      STRAND_ORDER.forEach(strandKey => {
        if (!strands[strandKey]) return;
        const subKeys = Object.keys(strands[strandKey].sub_strands);
        const allOn = subKeys.every(sk => activeSubStrands.has(`${strandKey}/${sk}`));
        const allBtn = document.getElementById(`btn-cap-${strandKey}`);
        if (allBtn) allBtn.style.opacity = allOn ? "1" : "0.45";
        subKeys.forEach(subKey => {
          const btn = document.getElementById(`btn-cap-${strandKey}-${subKey}`);
          if (btn) btn.style.opacity = activeSubStrands.has(`${strandKey}/${subKey}`) ? "1" : "0.35";
        });
      });
    }

    const ctrl = document.getElementById(CTRL_ID);

    STRAND_ORDER.forEach(strandKey => {
      if (!strands[strandKey]) return;
      const strand = strands[strandKey];
      const cfg = STRAND_CONFIG[strandKey] || {};
      const strandColor = cfg.color || "#888";
      const subKeys = Object.keys(strand.sub_strands);

      const strandBtn = document.createElement("button");
      strandBtn.id = `btn-cap-${strandKey}`; strandBtn.className = "strand-btn";
      strandBtn.textContent = cfg.label || strandKey;
      strandBtn.style.cssText = `background:${strandColor};color:#fff;border-color:transparent;font-weight:500`;
      strandBtn.onclick = () => {
        const allOn = subKeys.every(sk => activeSubStrands.has(`${strandKey}/${sk}`));
        subKeys.forEach(sk => {
          if (allOn) activeSubStrands.delete(`${strandKey}/${sk}`);
          else       activeSubStrands.add(`${strandKey}/${sk}`);
        });
        updateButtons(); render(data);
      };
      ctrl.appendChild(strandBtn);

      subKeys.forEach(subKey => {
        const sub = strand.sub_strands[subKey];
        const color = sub.color || strandColor;
        const laneKey = `${strandKey}/${subKey}`;
        const btn = document.createElement("button");
        btn.id = `btn-cap-${strandKey}-${subKey}`; btn.className = "strand-btn";
        btn.textContent = sub.short_label || sub.label;
        btn.style.cssText = `background:${color};color:#fff;border-color:transparent`;
        btn.onclick = () => {
          if (activeSubStrands.has(laneKey)) activeSubStrands.delete(laneKey);
          else activeSubStrands.add(laneKey);
          updateButtons(); render(data);
        };
        ctrl.appendChild(btn);
      });

      const sep = document.createElement("span");
      sep.style.cssText = "width:1px;background:#ddd;margin:0 4px;align-self:stretch;display:inline-block";
      ctrl.appendChild(sep);
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