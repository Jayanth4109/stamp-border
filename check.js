// node check.js
const a = require('assert');
const { holeCenters } = require('./code.js');

const [x0, y0, w, h] = [0, 0, 500, 380];
const pts = holeCenters(x0, y0, w, h, 22);

// each corner carries exactly one hole — zero strands a sliver of paper,
// two stack cutters on top of each other
const corners = [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]];
for (const [cx, cy] of corners) {
  const n = pts.filter((p) => p[0] === cx && p[1] === cy).length;
  a.strictEqual(n, 1, `corner ${cx},${cy} has ${n} holes`);
}

// every edge mirrors around its midpoint
const mirrors = (vals, len) => {
  const s = [...vals].sort((m, n) => m - n);
  const m = s.map((v) => len - v).sort((p, q) => p - q);
  return s.every((v, i) => Math.abs(v - m[i]) < 1e-9);
};
a.ok(mirrors(pts.filter((p) => p[1] === y0).map((p) => p[0]), w), 'top edge not symmetric');
a.ok(mirrors(pts.filter((p) => p[0] === x0).map((p) => p[1]), h), 'left edge not symmetric');

// tiny frame still gets one hole per edge instead of zero
a.strictEqual(holeCenters(0, 0, 5, 5, 100).length, 4); // just the 4 corners

console.log('ok —', pts.length, 'holes');
