// node docs/gen-preview.js
//
// Regenerates docs/preview.svg, the image in the README. The perforation comes
// from the plugin's own holeCenters(), so the picture can't drift from what the
// plugin actually cuts. vignette() mirrors the one in ui.html — no bundler here,
// so like the hole loop it's repeated rather than shared.
const fs = require('fs');
const path = require('path');
const { holeCenters } = require('../code.js');

const FW = 440, FH = 330;   // the frame being stamped
const PAD = 34, PERF = 11, SPACING = 26, RADIUS = 0;
const M = 36;               // backdrop margin

function vignette(x, y, w, h) {
  const ink = '#33413f', paper = '#ece5d5';
  const u = Math.min(w, h);
  const bh = Math.max(10, Math.min(h * 0.13, 46));
  const gy = h - bh;
  const r = u * 0.09;
  const px = w * 0.6, py = h * 0.28;
  const bl = w * 0.26, br = w * 0.96;
  const t = 0.74;
  const sy = py + (gy - py) * (1 - t);
  const bird = u * 0.035;
  const cap = Math.max(5, Math.min(bh * 0.46, w * 0.055));
  const num = h * 0.17;
  const arc = (bx, by) => `M${bx} ${by} q${bird} ${-bird} ${bird * 2} 0`;
  return (
    `<g transform="translate(${x} ${y})">` +
    `<rect width="${w}" height="${h}" fill="${paper}"/>` +
    `<circle cx="${w - r - w * 0.09}" cy="${r + h * 0.09}" r="${r}" fill="#c2593c" opacity=".9"/>` +
    `<path d="M${w * 0.01} ${gy} L${w * 0.24} ${h * 0.46} L${w * 0.52} ${gy} Z" fill="${ink}" opacity=".5"/>` +
    `<path d="M${bl} ${gy} L${px} ${py} L${br} ${gy} Z" fill="${ink}"/>` +
    `<path d="M${px} ${py} L${br + (px - br) * t} ${sy} L${bl + (px - bl) * t} ${sy} Z"` +
    ` fill="${paper}" opacity=".92"/>` +
    `<path d="${arc(w * 0.3, h * 0.2)} ${arc(w * 0.4, h * 0.14)}" fill="none" stroke="${ink}"` +
    ` stroke-width="${Math.max(1, u * 0.012)}" stroke-linecap="round" opacity=".45"/>` +
    `<text x="${w * 0.045}" y="${h * 0.06 + num}" font-size="${num}" font-weight="700"` +
    ` fill="${ink}" font-family="Georgia, 'Times New Roman', serif">25</text>` +
    `<rect y="${gy}" width="${w}" height="${bh}" fill="${ink}"/>` +
    `<text x="${w * 0.035}" y="${h - bh * 0.33}" font-size="${cap}" fill="${paper}"` +
    ` letter-spacing="${cap * 0.22}" font-family="Georgia, 'Times New Roman', serif">STAMP BORDER</text>` +
    `</g>`
  );
}

const w = FW + PAD * 2;
const h = FH + PAD * 2;
const pts = holeCenters(0, 0, w, h, SPACING);
const cut = pts
  .map(([cx, cy]) => `<circle cx="${+cx.toFixed(2)}" cy="${+cy.toFixed(2)}" r="${PERF}"/>`)
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w + M * 2}" height="${h + M * 2}" viewBox="${-M} ${-M} ${w + M * 2} ${h + M * 2}" role="img" aria-label="A frame wrapped in a perforated postage-stamp border by the Stamp Border Figma plugin">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#181c1f"/>
      <stop offset="1" stop-color="#0d1012"/>
    </linearGradient>
    <filter id="sh" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-opacity=".55"/>
    </filter>
    <mask id="perf">
      <rect width="${w}" height="${h}" rx="${RADIUS}" fill="#fff"/>
      <g fill="#000">${cut}</g>
    </mask>
    <clipPath id="paper"><rect width="${w}" height="${h}" rx="${RADIUS}"/></clipPath>
  </defs>
  <rect x="${-M}" y="${-M}" width="${w + M * 2}" height="${h + M * 2}" fill="url(#bg)"/>
  <g filter="url(#sh)">
    <g mask="url(#perf)">
      <rect width="${w}" height="${h}" rx="${RADIUS}" fill="#ffffff"/>
      <g clip-path="url(#paper)">${vignette(PAD, PAD, FW, FH)}</g>
    </g>
  </g>
</svg>
`;

fs.writeFileSync(path.join(__dirname, 'preview.svg'), svg);
console.log(`wrote docs/preview.svg — ${w}x${h} paper, ${pts.length} perforations`);
