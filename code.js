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
  figma.showUI(__html__, { width: 300, height: 559, themeColors: true });

  let targets = pickTargets();
  figma.on('selectionchange', () => { targets = pickTargets(); report(targets); });

  figma.ui.onmessage = (msg) => {
    // The UI asks once it's listening — posting earlier races the iframe load,
    // and a frame selected before the plugin opened would go unnoticed.
    if (msg.type === 'ready') { report(targets); return; }

    if (msg.type === 'remove') {
      if (!targets.length) { figma.notify('Select a stamped frame'); return; }
      const gone = targets.filter(strip).length;
      figma.currentPage.selection = targets;
      figma.notify(gone ? `Removed ${gone === 1 ? 'the stamp' : gone + ' stamps'}` : 'That frame has no stamp');
      return;
    }

    if (msg.type !== 'apply') return;
    if (!targets.length) { figma.notify('Select a frame to stamp'); return; }
    figma.currentPage.selection = targets.map((n) => { unwrap(n); return build(n, msg.opts); });
  };
}

// Hand the UI the frame's real shape, plus the settings this frame was stamped
// with so the controls land exactly where the user left them. A frame that has
// never been stamped reports none, and the UI falls back to its defaults —
// carrying the last-used settings over instead meant the defaults were never
// what you actually saw.
function report(targets) {
  const n = targets[0];
  figma.ui.postMessage({
    type: 'selection',
    count: targets.length,
    id: n ? n.id : null,
    name: n ? n.name : null,
    w: n ? n.width : null,
    h: n ? n.height : null,
    opts: (n && readOpts(n)) || null,
    stamped: !!(n && readOpts(n)),
  });
}

// Settings ride on the frame itself, not the group — so they survive a rebuild,
// an ungroup, and a duplicate, and each stamp remembers its own.
function readOpts(node) {
  try {
    return JSON.parse(node.getPluginData('opts')) || null;
  } catch (e) {
    return null; // never written, or written by an older version
  }
}

// --- targets -----------------------------------------------------------

// A stamp group resolves to its content, so re-running just re-cuts it. The
// parts we build carry a role tag, so whatever is left is the user's frame —
// which beats matching on type or name, both of which they can change.
function inner(n) {
  if (n.type !== 'GROUP' || n.name !== STAMP) return n;
  const kids = n.children;
  const wrap = kids.find((c) => c.getPluginData('role') === 'wrap');
  if (wrap) return wrap.children[0] || null;
  // Stamps from earlier versions have no wrapper, and the oldest have no role
  // tags at all — where asking for the untagged child hands back the
  // perforation. Either way, resolve to the frame so they re-cut in place.
  const tagged = kids.some((c) => c.getPluginData('role'));
  return (tagged
    ? kids.find((c) => !c.getPluginData('role'))
    : kids.find((c) => c.type !== 'BOOLEAN_OPERATION')) || null;
}

function pickTargets() {
  return figma.currentPage.selection.map(inner).filter((n) => n && 'resize' in n);
}

// The stamp group a frame belongs to, if any. The frame rides inside the
// content wrapper, so that's one level further up than you'd expect.
function stampOf(node) {
  let g = node.parent;
  if (g && g.type === 'GROUP' && g.getPluginData('role') === 'wrap') g = g.parent;
  return g && g.type === 'GROUP' && g.name === STAMP ? g : null;
}

function unwrap(node) {
  const g = stampOf(node);
  if (!g) return;
  // Groups don't make a new coord space, so x/y survive the move out.
  g.parent.insertChild(g.parent.children.indexOf(g), node);
  // The group still holds the perforation and the paper, so it won't self-delete
  // — drop it explicitly or every re-run strands another one on the canvas.
  if (!g.removed) g.remove();
}

// Give the frame back on its own, carrying nothing of ours. The saved settings
// go too: with no stamp left, reporting them would light the recall dot for a
// stamp that isn't there. The UI keeps showing them either way.
function strip(node) {
  if (!stampOf(node)) return false;
  unwrap(node);
  node.setPluginData('opts', '');
  return true;
}

// --- build -------------------------------------------------------------

function build(node, o) {
  const parent = node.parent;

  // A Figma mask does not reach inside a frame that clips its content — mask the
  // frame directly and it comes out uncut, which is why zero padding used to do
  // nothing. Masking a plain group around it does work, so the frame rides in a
  // wrapper and the mask clips that.
  const wrap = figma.group([node], parent);
  wrap.name = 'Content';
  wrap.setPluginData('role', 'wrap');

  const x0 = wrap.x - o.pad;
  const y0 = wrap.y - o.pad;
  const w = wrap.width + o.pad * 2;
  const h = wrap.height + o.pad * 2;

  const base = figma.createRectangle();
  parent.appendChild(base);
  base.resize(w, h);
  base.x = x0;
  base.y = y0;
  base.cornerRadius = o.radius;

  const holes = holeCenters(x0, y0, w, h, o.spacing).map(([cx, cy]) => circle(parent, cx, cy, o.perf));

  // subtract() takes the base shape first, cutters after.
  const shape = figma.subtract([base].concat(holes), parent, parent.children.indexOf(wrap));
  shape.name = 'Perforation';
  shape.setPluginData('role', 'perf');
  shape.fills = [{ type: 'SOLID', color: hex(o.color) }];
  // A Figma mask clips every sibling above it, so the paper and the frame both
  // take the perforated silhouette. That's what makes zero padding bite into the
  // frame itself rather than hiding the holes behind it.
  shape.isMask = true;

  // A mask's own paint never renders, so the visible paper is a plain rect
  // sitting just above it, cut to shape by the mask.
  const paper = figma.createRectangle();
  parent.insertChild(parent.children.indexOf(wrap), paper);
  paper.resize(w, h);
  paper.x = x0;
  paper.y = y0;
  paper.cornerRadius = o.radius;
  paper.name = 'Paper';
  paper.setPluginData('role', 'paper');
  paper.fills = [{ type: 'SOLID', color: hex(o.color) }];

  const g = figma.group([shape, paper, wrap], parent);
  // The shadow goes on the group, not the mask — a mask's effects don't render,
  // and here it traces the perforated edge instead of a plain rectangle.
  g.effects = o.shadow
    ? [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 2 }, radius: 12, spread: 0, visible: true, blendMode: 'NORMAL' }]
    : [];
  g.name = STAMP;
  // Last, so a build that fails partway doesn't leave the frame claiming to be
  // stamped with settings that were never applied to it.
  node.setPluginData('opts', JSON.stringify(o));
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
