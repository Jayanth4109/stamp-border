const STAMP = 'Stamp Border';

// Centers of the perforation holes, walking each edge.
// Like a real perforated stamp, each corner gets a hole shared by both edges —
// offsetting them inward instead leaves a sliver of paper stranded at the corner.
function holeCenters(x0, y0, w, h, spacing) {
  const nx = Math.max(1, Math.round(w / spacing));
  const ny = Math.max(1, Math.round(h / spacing));
  const out = [];
  for (let i = 0; i <= nx; i++) {
    const cx = x0 + (i * w) / nx;
    out.push([cx, y0], [cx, y0 + h]);
  }
  for (let i = 1; i < ny; i++) { // skip i=0 and i=ny: the rows above own those corners
    const cy = y0 + (i * h) / ny;
    out.push([x0, cy], [x0 + w, cy]);
  }
  return out;
}

function main() {
  figma.showUI(__html__, { width: 300, height: 500, themeColors: true });

  figma.clientStorage.getAsync('opts').then((opts) => figma.ui.postMessage({ type: 'init', opts }));

  let targets = pickTargets();
  figma.on('selectionchange', () => { targets = pickTargets(); });

  figma.ui.onmessage = (msg) => {
    if (msg.type !== 'apply') return;
    if (!targets.length) { figma.notify('Select a frame to stamp'); return; }
    figma.clientStorage.setAsync('opts', msg.opts);
    figma.currentPage.selection = targets.map((n) => { unwrap(n); return build(n, msg.opts); });
  };
}

// --- targets -----------------------------------------------------------

// A stamp group resolves to its content, so re-running just re-cuts it.
function inner(n) {
  if (n.type === 'GROUP' && n.name === STAMP) {
    return n.children.find((c) => c.type !== 'BOOLEAN_OPERATION') || null;
  }
  return n;
}

function pickTargets() {
  return figma.currentPage.selection.map(inner).filter((n) => n && 'resize' in n);
}

function unwrap(node) {
  const g = node.parent;
  if (!g || g.type !== 'GROUP' || g.name !== STAMP) return;
  // Groups don't make a new coord space, so x/y survive the move out.
  g.parent.insertChild(g.parent.children.indexOf(g), node); // empty group self-deletes
}

// --- build -------------------------------------------------------------

function build(node, o) {
  const parent = node.parent;
  const x0 = node.x - o.pad;
  const y0 = node.y - o.pad;
  const w = node.width + o.pad * 2;
  const h = node.height + o.pad * 2;

  const rect = figma.createRectangle();
  parent.appendChild(rect);
  rect.resize(w, h);
  rect.x = x0;
  rect.y = y0;
  rect.cornerRadius = o.radius;

  const holes = holeCenters(x0, y0, w, h, o.spacing).map(([cx, cy]) => circle(parent, cx, cy, o.perf));

  // subtract() takes the base shape first, cutters after.
  const shape = figma.subtract([rect].concat(holes), parent, parent.children.indexOf(node));
  shape.name = 'Perforation';
  shape.fills = [{ type: 'SOLID', color: hex(o.color) }];
  shape.effects = o.shadow
    ? [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 2 }, radius: 12, spread: 0, visible: true, blendMode: 'NORMAL' }]
    : [];

  const g = figma.group([shape, node], parent);
  g.name = STAMP;
  return g;
}

function circle(parent, cx, cy, r) {
  const e = figma.createEllipse();
  parent.appendChild(e);
  e.resize(r * 2, r * 2);
  e.x = cx - r;
  e.y = cy - r;
  return e;
}

function hex(s) {
  const n = parseInt(s.replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

if (typeof figma !== 'undefined') main();
else module.exports = { holeCenters }; // for check.js
