import QRCode from "qrcode";
import { DEFAULT_STYLE, LOGO_DATA_URI, styleSchema, type DotShape, type EyeBall, type EyeFrame, type QrStyle } from "./style";

/**
 * Pure, isomorphic QR renderer: text + style -> SVG string.
 * Runs identically in the browser (live preview), on the server (API / export)
 * and in tests (decode round-trip), so what you see is exactly what is exported.
 */

type Cmd = [string, ...number[]];
const f = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Maps unit-square (0..1) path commands onto a `size` x `size` box whose top-left is (x, y),
 * scaled by `scale` about the box centre (scale > 1 draws slightly oversized).
 */
function unitPath(cmds: Cmd[], x: number, y: number, size: number, scale: number): string {
  return (
    cmds
      .map(([op, ...c]) => {
        const pts = c.map((v, i) => f((i % 2 === 0 ? x : y) + size * (0.5 + (v - 0.5) * scale)));
        return op + pts.join(" ");
      })
      .join("") + "Z"
  );
}

const HEART: Cmd[] = [
  ["M", 0.5, 0.93],
  ["C", 0.5, 0.93, 0.02, 0.62, 0.02, 0.3],
  ["C", 0.02, 0.13, 0.15, 0.03, 0.29, 0.03],
  ["C", 0.4, 0.03, 0.47, 0.09, 0.5, 0.18],
  ["C", 0.53, 0.09, 0.6, 0.03, 0.71, 0.03],
  ["C", 0.85, 0.03, 0.98, 0.13, 0.98, 0.3],
  ["C", 0.98, 0.62, 0.5, 0.93, 0.5, 0.93],
];
const DIAMOND: Cmd[] = [["M", 0.5, 0], ["L", 1, 0.5], ["L", 0.5, 1], ["L", 0, 0.5]];

/** Rounded rectangle path (absolute coordinates). r is clamped to half the shortest side. */
function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
  return (
    `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(h - 2 * r)}` +
    `a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(-(w - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}` +
    `v${f(-(h - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}Z`
  );
}

function dotPath(shape: DotShape, x: number, y: number): string {
  switch (shape) {
    case "square":
      // Slight overlap (0.02) hides hairline seams between neighbouring modules when rasterised.
      return `M${f(x - 0.01)} ${f(y - 0.01)}h1.02v1.02h-1.02Z`;
    case "rounded":
      return roundRect(x + 0.04, y + 0.04, 0.92, 0.92, 0.3);
    case "circle":
      return roundRect(x + 0.03, y + 0.03, 0.94, 0.94, 0.47);
    case "heart":
      // Hearts cover less area than squares, so they are drawn slightly oversized to keep the code scannable.
      return unitPath(HEART, x, y, 1, 1.12);
    case "diamond":
      return unitPath(DIAMOND, x, y, 1, 1.18);
  }
}

/** Outer 7x7 ring with a 5x5 hole, using even-odd fill. */
function eyeFramePath(shape: EyeFrame, x: number, y: number): string {
  const r = shape === "square" ? 0 : shape === "rounded" ? 1.8 : 3.5;
  const ri = shape === "square" ? 0 : shape === "rounded" ? 0.9 : 2.5;
  return roundRect(x, y, 7, 7, r) + roundRect(x + 1, y + 1, 5, 5, ri);
}

/** Inner 3x3 pupil. */
function eyeBallPath(shape: EyeBall, x: number, y: number): string {
  switch (shape) {
    case "square":
      return roundRect(x + 2, y + 2, 3, 3, 0);
    case "rounded":
      return roundRect(x + 2, y + 2, 3, 3, 0.8);
    case "circle":
      return roundRect(x + 2, y + 2, 3, 3, 1.5);
  }
}

export interface QrMatrix {
  size: number;
  get(row: number, col: number): boolean;
}

export function getMatrix(text: string, ecc: QrStyle["ecc"]): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecc });
  const { size } = qr.modules;
  return { size, get: (r, c) => qr.modules.get(r, c) === 1 };
}

const inFinder = (r: number, c: number, n: number) =>
  (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

/** Escapes attribute values defensively, even though inputs are already validated. */
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function renderSvg(text: string, styleInput: Partial<QrStyle> = {}): string {
  // Re-validate every time: colors, logo URIs etc. must never reach the SVG unchecked.
  const style = styleSchema.parse({ ...DEFAULT_STYLE, ...styleInput });
  // A logo punches a hole in the data modules, so force maximum error correction.
  const ecc = style.logo ? "H" : style.ecc;
  const m = getMatrix(text, ecc);
  const n = m.size;
  const margin = style.margin;
  const total = n + margin * 2;
  const eyeColor = style.eyeColor ?? style.fg;

  // Logo hole (in module units, centred).
  let hole: { x0: number; y0: number; x1: number; y1: number } | null = null;
  if (style.logo) {
    if (!LOGO_DATA_URI.test(style.logo.href)) throw new Error("Invalid logo");
    const side = n * style.logo.size;
    const pad = 1; // one module of clear space around the logo
    hole = { x0: n / 2 - side / 2 - pad, y0: n / 2 - side / 2 - pad, x1: n / 2 + side / 2 + pad, y1: n / 2 + side / 2 + pad };
  }

  let dots = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!m.get(r, c) || inFinder(r, c, n)) continue;
      if (hole && c + 0.5 > hole.x0 && c + 0.5 < hole.x1 && r + 0.5 > hole.y0 && r + 0.5 < hole.y1) continue;
      dots += dotPath(style.dotShape, c + margin, r + margin);
    }
  }

  const eyes = [
    [margin, margin],
    [margin + n - 7, margin],
    [margin, margin + n - 7],
  ];
  const frames = eyes.map(([x, y]) => eyeFramePath(style.eyeFrame, x, y)).join("");
  const balls = eyes.map(([x, y]) => eyeBallPath(style.eyeBall, x, y)).join("");

  let logo = "";
  if (hole && style.logo) {
    const side = n * style.logo.size;
    const lx = margin + n / 2 - side / 2;
    const ly = margin + n / 2 - side / 2;
    logo =
      `<rect x="${f(lx - 0.6)}" y="${f(ly - 0.6)}" width="${f(side + 1.2)}" height="${f(side + 1.2)}" rx="1" fill="${style.bg}"/>` +
      `<image href="${esc(style.logo.href)}" x="${f(lx)}" y="${f(ly)}" width="${f(side)}" height="${f(side)}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="geometricPrecision">` +
    `<rect width="${total}" height="${total}" fill="${style.bg}"/>` +
    `<path d="${dots}" fill="${style.fg}"/>` +
    `<path d="${frames}" fill="${eyeColor}" fill-rule="evenodd"/>` +
    `<path d="${balls}" fill="${eyeColor}"/>` +
    logo +
    `</svg>`
  );
}
