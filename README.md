# Stamp Border

A Figma plugin that wraps any frame in a perforated postage-stamp edge.

![Stamp Border preview](docs/preview.svg)

Select a frame, run the plugin, drag the sliders. The perforation is a real
boolean-subtracted vector shape, so it scales, recolors and exports like any
other Figma layer.

## Install

No build step — plain JS, no dependencies.

1. Clone this repo.
2. Figma desktop → **Plugins → Development → Import plugin from manifest…**
3. Pick `manifest.json`.

## Use

Select a frame and run **Plugins → Development → Stamp Border**.

| Control | What it does |
| --- | --- |
| Padding | Paper margin around your frame |
| Perf size | Radius of each perforation bite |
| Perf spacing | Distance between perforation centers |
| Corner | Corner radius of the paper |
| Paper | Fill color of the stamp |
| Shadow | Soft drop shadow under the paper |

Presets: **Classic**, **Fine**, **Chunky**, **Rounded**.

Re-running on an already-stamped frame re-cuts it in place instead of nesting
another border, so you can drag the sliders and watch the canvas update. The
result is a group named `Stamp Border` holding the perforation shape and your
original frame — ungroup it any time to get your frame back untouched.

Settings persist between runs.

## How it works

`code.js` builds a rectangle the size of your frame plus padding, scatters
ellipses along its four edges, and boolean-subtracts them into a single shape
placed behind the frame.

Hole centers sit at half-step offsets along each edge
(`x0 + (i + 0.5) * width / n`), which keeps them off the corners and makes
every edge mirror around its midpoint. That's the only non-obvious math, and
it's what `check.js` covers:

```bash
node check.js
```

## Files

| File | |
| --- | --- |
| `manifest.json` | Figma plugin manifest |
| `code.js` | Plugin sandbox — geometry and node creation |
| `ui.html` | Panel UI with live SVG preview |
| `check.js` | Geometry assertions |

## License

MIT
