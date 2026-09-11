// node check-rebuild.js
//
// Re-running the plugin must re-cut the frame in place, not pile up a new
// stamp each time. Dragging a slider fires many applies in a row, so this
// stands up just enough of the Figma node API to run code.js headlessly and
// count what is left on the page afterwards.
const a = require('assert');

let SEQ = 0;

class Node {
  constructor(type, name) {
    this.type = type;
    this.name = name || type;
    this.id = `${type}:${++SEQ}`;
    this.x = 0; this.y = 0; this.width = 100; this.height = 100;
    this.children = [];
    this.parent = null;
    this.removed = false;
    this.data = {};
  }
  resize(w, h) { this.width = w; this.height = h; }
  getPluginData(k) { return this.data[k] || ''; }
  setPluginData(k, v) { this.data[k] = v; }
  _detach(n) {
    const i = this.children.indexOf(n);
    if (i >= 0) this.children.splice(i, 1);
    // Figma collects a group only once it has no children left.
    if (this.type === 'GROUP' && this.children.length === 0 && this.parent) this.parent._detach(this);
  }
  remove() {
    if (this.parent) this.parent._detach(this);
    this.removed = true;
    this.children.forEach((c) => c.remove());
  }
  appendChild(n) { if (n.parent) n.parent._detach(n); n.parent = this; this.children.push(n); }
  insertChild(i, n) { if (n.parent) n.parent._detach(n); n.parent = this; this.children.splice(i, 0, n); }
}

const page = new Node('PAGE', 'Page 1');
page.selection = [];
const store = {};
const posted = [];

global.__html__ = '';
global.figma = {
  currentPage: page,
  showUI() {},
  notify() {},
  clientStorage: {
    getAsync: (k) => Promise.resolve(store[k]),
    setAsync: (k, v) => { store[k] = v; return Promise.resolve(); },
  },
  ui: { postMessage(m) { posted.push(m); }, onmessage: null },
  on(evt, fn) { (this._handlers = this._handlers || {})[evt] = fn; },
  createRectangle() { return new Node('RECTANGLE'); },
  createEllipse() { return new Node('ELLIPSE'); },
  subtract(nodes, parent, index) {
    const b = new Node('BOOLEAN_OPERATION', 'Subtract');
    nodes.forEach((n) => b.appendChild(n));
    parent.insertChild(index, b);
    return b;
  },
  group(nodes, parent) {
    const at = Math.min.apply(null, nodes.map((n) => parent.children.indexOf(n)).filter((i) => i >= 0));
    const g = new Node('GROUP', 'Group');
    nodes.forEach((n) => g.appendChild(n));
    parent.insertChild(isFinite(at) ? at : parent.children.length, g);
    return g;
  },
};

require('./code.js');

const frame = new Node('FRAME', 'Poster');
frame.width = 400;
frame.height = 260;
page.appendChild(frame);
page.selection = [frame];
figma._handlers.selectionchange();

const OPTS = { pad: 28, perf: 9, spacing: 22, radius: 0, color: '#FFFFFF', shadow: true };

for (let i = 1; i <= 6; i++) {
  figma.ui.onmessage({ type: 'apply', opts: Object.assign({}, OPTS, { perf: 8 + i }) });
  figma._handlers.selectionchange(); // Figma fires this once selection is set
  a.strictEqual(page.children.length, 1, `apply #${i} left ${page.children.length} nodes on the page`);
}

const g = page.children[0];
a.strictEqual(g.type, 'GROUP');
a.strictEqual(g.name, 'Stamp Border');

// Bottom to top: the mask, the paper it cuts, then the wrapped content. A Figma
// mask only clips siblings above it, so this order is what cuts them both. The
// frame must sit inside a GROUP, not be a direct child — a mask doesn't reach
// inside a frame that clips its content, and zero padding silently does nothing.
a.deepStrictEqual(g.children.map((c) => c.name), ['Perforation', 'Paper', 'Content']);
a.strictEqual(g.children[0].isMask, true, 'the perforation has to be the mask');
a.ok(!g.children[1].isMask && !g.children[2].isMask, 'only the perforation masks');
a.strictEqual(g.children[2].type, 'GROUP', 'the frame must be wrapped, not masked directly');

// The frame itself survives every rebuild — same node, same size.
a.deepStrictEqual(g.children[2].children, [frame], 'the wrapper should hold just the frame');
a.strictEqual(frame.width, 400);
a.strictEqual(frame.height, 260);

const before = page.children.length;
figma.ui.onmessage({ type: 'apply', opts: OPTS });
a.strictEqual(page.children.length, before);

// Settings ride on the frame, so selecting a stamped frame reports back exactly
// what it was stamped with and the sliders can land where the user left them.
const CUSTOM = { pad: 41, perf: 13, spacing: 31, radius: 7, color: '#C0FFEE', shadow: false };
figma.ui.onmessage({ type: 'apply', opts: CUSTOM });
figma._handlers.selectionchange();

const msg = posted[posted.length - 1];
a.strictEqual(msg.type, 'selection');
a.strictEqual(msg.stamped, true);
a.deepStrictEqual(msg.opts, CUSTOM, 'the frame did not report its own settings back');
a.strictEqual(msg.id, frame.id, 'the UI needs an id to tell one frame from the next');

// An unstamped frame has nothing of its own to report.
const fresh = new Node('FRAME', 'Untouched');
page.appendChild(fresh);
page.selection = [fresh];
figma._handlers.selectionchange();
a.strictEqual(posted[posted.length - 1].stamped, false);

// A stamp built by the version before role tags existed: re-running has to
// re-cut it, not treat the untagged perforation as the user's artwork.
const legacy = new Node('GROUP', 'Stamp Border');
const legacyFrame = new Node('FRAME', 'Old Poster');
legacyFrame.width = 320;
legacyFrame.height = 240;
page.appendChild(legacy);
legacy.appendChild(new Node('BOOLEAN_OPERATION', 'Perforation'));
legacy.appendChild(legacyFrame);

page.selection = [legacy];
figma._handlers.selectionchange();
a.strictEqual(posted[posted.length - 1].name, 'Old Poster', 'legacy stamp resolved to the wrong node');

const roots = page.children.length;
figma.ui.onmessage({ type: 'apply', opts: OPTS });
a.strictEqual(page.children.length, roots, 'restamping a legacy group left something behind');

const rebuilt = legacyFrame.parent.parent;
a.strictEqual(rebuilt.name, 'Stamp Border');
a.deepStrictEqual(rebuilt.children.map((c) => c.name), ['Perforation', 'Paper', 'Content']);
a.strictEqual(rebuilt.children[0].isMask, true);

// Remove hands the frame back on its own, taking the helper layers and the
// saved settings with it.
page.selection = [rebuilt];
figma._handlers.selectionchange();
figma.ui.onmessage({ type: 'remove' });

a.strictEqual(legacyFrame.parent, page, 'the frame should be back on the page');
a.ok(!page.children.includes(rebuilt), 'the stamp group outlived its removal');
a.strictEqual(legacyFrame.getPluginData('opts'), '');
a.strictEqual(legacyFrame.width, 320, 'the frame came back resized');

figma._handlers.selectionchange();
a.strictEqual(posted[posted.length - 1].stamped, false, 'a stripped frame still claims a stamp');

const stamps = page.children.filter((c) => c.name === 'Stamp Border').length;
console.log(`ok — 9 applies, ${stamps} stamps on the page, none stranded`);
