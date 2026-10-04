import type { Blank, BlankId } from "./types";

// Garment artwork is authored as parametric SVG in a 1000x1000 viewBox. Each
// blank is split into `base` (the colored silhouette, drawn UNDER the design)
// and `shade` (shadows, highlights, seams, fabric grain, drawn OVER it), so the
// print inherits the garment's lighting in the live preview and the mockup.

const svgOpen = (extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" ${extra}>`;
const svgClose = `</svg>`;

/** Fabric grain + lighting defs shared by every blank. */
function commonDefs(prefix: string) {
  return `
  <filter id="${prefix}-grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.5" intercept="-0.05"/></feComponentTransfer>
  </filter>
  <filter id="${prefix}-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="${prefix}-softer" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18"/></filter>
  <linearGradient id="${prefix}-sides" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
    <stop offset="0.16" stop-color="#000" stop-opacity="0.06"/>
    <stop offset="0.5" stop-color="#000" stop-opacity="0"/>
    <stop offset="0.84" stop-color="#000" stop-opacity="0.06"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.55"/>
  </linearGradient>
  <linearGradient id="${prefix}-bottom" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="#000" stop-opacity="0"/>
    <stop offset="0.7" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.28"/>
  </linearGradient>
  <radialGradient id="${prefix}-key" cx="0.42" cy="0.32" r="0.6">
    <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
    <stop offset="0.5" stop-color="#fff" stop-opacity="0.06"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="${prefix}-spot" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#000" stop-opacity="0.42"/>
    <stop offset="1" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="${prefix}-rim" x1="0" x2="1" y1="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0.35"/>
    <stop offset="0.5" stop-color="#fff" stop-opacity="0.05"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.35"/>
  </linearGradient>`;
}

function darken(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amt))));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ------------------------------------------------------------------ TEE */

const TEE_BODY = (neck: string) => `
M 362 196
${neck}
L 792 246
C 862 282 918 362 928 428
L 778 486
C 762 462 748 438 742 412
C 744 580 748 760 752 896
C 606 928 394 928 248 896
C 252 760 256 580 258 412
C 252 438 238 462 222 486
L 72 428
C 82 362 138 282 208 246
Z`;

const FRONT_NECK = "C 410 284 590 284 638 196";
const BACK_NECK = "C 420 228 580 228 638 196";

function teeBase(hex: string, back: boolean) {
  const p = back ? "tb" : "tf";
  const neck = back ? BACK_NECK : FRONT_NECK;
  const body = TEE_BODY(neck);
  return `${svgOpen()}
  <defs>
    <clipPath id="${p}-clip"><path d="${body}"/></clipPath>
  </defs>
  <path d="${body}" fill="${hex}"/>
  <!-- collar rib -->
  <path d="M 362 196 ${neck}" fill="none" stroke="${darken(hex, 0.18)}" stroke-width="26" stroke-linecap="round"/>
  <path d="M 362 196 ${neck}" fill="none" stroke="${hex}" stroke-width="12" stroke-linecap="round" opacity="0.9"/>
  ${svgClose}`;
}

function teeShade(_hex: string, back: boolean) {
  const p = back ? "tbs" : "tfs";
  const neck = back ? BACK_NECK : FRONT_NECK;
  const body = TEE_BODY(neck);
  const seam = `rgba(0,0,0,0.28)`;
  return `${svgOpen()}
  <defs>
    ${commonDefs(p)}
    <clipPath id="${p}-clip"><path d="${body}"/></clipPath>
  </defs>
  <g clip-path="url(#${p}-clip)">
    <rect x="0" y="0" width="1000" height="1000" fill="url(#${p}-sides)"/>
    <rect x="0" y="0" width="1000" height="1000" fill="url(#${p}-bottom)"/>
    <rect x="0" y="0" width="1000" height="1000" fill="url(#${p}-key)"/>
    <!-- armpit shadows -->
    <ellipse cx="752" cy="430" rx="120" ry="90" fill="url(#${p}-spot)"/>
    <ellipse cx="248" cy="430" rx="120" ry="90" fill="url(#${p}-spot)"/>
    <!-- sleeve undersides -->
    <path d="M 778 486 L 928 428" stroke="#000" stroke-opacity="0.35" stroke-width="22" filter="url(#${p}-soft)"/>
    <path d="M 222 486 L 72 428" stroke="#000" stroke-opacity="0.35" stroke-width="22" filter="url(#${p}-soft)"/>
    <!-- under-collar shadow -->
    <path d="M 376 214 ${back ? "C 420 246 580 246 624 214" : "C 414 300 586 300 624 214"}" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="18" filter="url(#${p}-soft)"/>
    <!-- fabric folds -->
    <path d="M 318 600 C 300 700 318 800 330 896" fill="none" stroke="#000" stroke-opacity="0.16" stroke-width="16" filter="url(#${p}-softer)"/>
    <path d="M 346 610 C 332 710 346 800 356 896" fill="none" stroke="#fff" stroke-opacity="0.08" stroke-width="10" filter="url(#${p}-softer)"/>
    <path d="M 690 560 C 712 680 700 800 686 896" fill="none" stroke="#000" stroke-opacity="0.14" stroke-width="18" filter="url(#${p}-softer)"/>
    <path d="M 560 760 C 600 790 640 820 660 896" fill="none" stroke="#000" stroke-opacity="0.08" stroke-width="14" filter="url(#${p}-softer)"/>
    <!-- fabric grain -->
    <rect x="0" y="0" width="1000" height="1000" filter="url(#${p}-grain)" opacity="0.5" style="mix-blend-mode:overlay"/>
    <!-- seams and stitching -->
    <path d="M 792 246 C 790 320 770 380 742 412" fill="none" stroke="${seam}" stroke-width="2"/>
    <path d="M 208 246 C 210 320 230 380 258 412" fill="none" stroke="${seam}" stroke-width="2"/>
    <path d="M 252 880 C 400 912 600 912 748 880" fill="none" stroke="${seam}" stroke-width="2" stroke-dasharray="6 5"/>
    <path d="M 780 474 L 916 418" fill="none" stroke="${seam}" stroke-width="2" stroke-dasharray="6 5"/>
    <path d="M 220 474 L 84 418" fill="none" stroke="${seam}" stroke-width="2" stroke-dasharray="6 5"/>
    <path d="M 362 196 ${neck}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="2" transform="translate(0,13)"/>
    ${back ? `<rect x="482" y="236" width="36" height="22" rx="3" fill="#f5f1e8" opacity="0.92"/><rect x="488" y="243" width="24" height="3" fill="#333" opacity="0.6"/><rect x="488" y="249" width="16" height="2" fill="#333" opacity="0.5"/>` : ""}
  </g>
  <path d="${body}" fill="none" stroke="url(#${p}-rim)" stroke-width="2.5"/>
  ${svgClose}`;
}

/* ------------------------------------------------------------------ HAT (front) */

const CROWN_FRONT = `M 172 572 C 166 430 222 296 326 238 C 386 206 440 194 500 194 C 560 194 614 206 674 238 C 778 296 834 430 828 572 C 700 616 300 616 172 572 Z`;
const VISOR_FRONT = `M 142 548 C 210 720 790 720 858 548 C 770 604 230 604 142 548 Z`;

function hatFrontBase(hex: string) {
  return `${svgOpen()}
  <path d="${CROWN_FRONT}" fill="${hex}"/>
  <path d="${VISOR_FRONT}" fill="${darken(hex, 0.08)}"/>
  <circle cx="500" cy="200" r="15" fill="${darken(hex, 0.1)}"/>
  ${svgClose}`;
}

function hatFrontShade(hex: string) {
  const p = "hfs";
  const seam = `rgba(0,0,0,0.3)`;
  return `${svgOpen()}
  <defs>
    ${commonDefs(p)}
    <clipPath id="${p}-crown"><path d="${CROWN_FRONT}"/></clipPath>
    <clipPath id="${p}-visor"><path d="${VISOR_FRONT}"/></clipPath>
    <radialGradient id="${p}-dome" cx="0.38" cy="0.28" r="0.75">
      <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
      <stop offset="0.45" stop-color="#fff" stop-opacity="0.04"/>
      <stop offset="0.8" stop-color="#000" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.5"/>
    </radialGradient>
    <linearGradient id="${p}-visorg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="0.35" stop-color="#000" stop-opacity="0.1"/>
      <stop offset="0.7" stop-color="#fff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#${p}-crown)">
    <rect x="0" y="0" width="1000" height="1000" fill="url(#${p}-dome)"/>
    <rect x="0" y="0" width="1000" height="1000" fill="url(#${p}-sides)"/>
    <!-- panel seams -->
    <path d="M 500 212 L 500 600" fill="none" stroke="${seam}" stroke-width="3"/>
    <path d="M 500 212 L 500 600" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="1" transform="translate(3,0)"/>
    <path d="M 488 206 C 360 250 290 380 282 596" fill="none" stroke="${seam}" stroke-width="3"/>
    <path d="M 512 206 C 640 250 710 380 718 596" fill="none" stroke="${seam}" stroke-width="3"/>
    <!-- seam shadows -->
    <path d="M 488 206 C 360 250 290 380 282 596" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="22" filter="url(#${p}-soft)"/>
    <path d="M 512 206 C 640 250 710 380 718 596" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="22" filter="url(#${p}-soft)"/>
    <!-- side panels fall away: darker -->
    <path d="M 172 572 C 166 430 222 296 326 238 C 300 360 282 480 282 596 Z" fill="#000" fill-opacity="0.18" filter="url(#${p}-softer)"/>
    <path d="M 828 572 C 834 430 778 296 674 238 C 700 360 718 480 718 596 Z" fill="#000" fill-opacity="0.18" filter="url(#${p}-softer)"/>
    <!-- eyelets -->
    <circle cx="392" cy="400" r="7" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="3"/>
    <circle cx="608" cy="400" r="7" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="3"/>
    <!-- visor cast shadow onto crown -->
    <path d="M 172 572 C 300 614 700 614 828 572" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="30" filter="url(#${p}-soft)"/>
    <rect x="0" y="0" width="1000" height="1000" filter="url(#${p}-grain)" opacity="0.5" style="mix-blend-mode:overlay"/>
  </g>
  <path d="${CROWN_FRONT}" fill="none" stroke="url(#${p}-rim)" stroke-width="2.5"/>
  <g clip-path="url(#${p}-visor)">
    <rect x="0" y="0" width="1000" height="1000" fill="${darken(hex, 0.08)}"/>
    <rect x="0" y="0" width="1000" height="1000" fill="url(#${p}-visorg)"/>
    <rect x="0" y="0" width="1000" height="1000" filter="url(#${p}-grain)" opacity="0.4" style="mix-blend-mode:overlay"/>
    <path d="M 156 566 C 222 700 778 700 844 566" fill="none" stroke="${seam}" stroke-width="2" stroke-dasharray="7 5"/>
    <path d="M 172 582 C 236 680 764 680 828 582" fill="none" stroke="${seam}" stroke-width="2" stroke-dasharray="7 5"/>
    <path d="M 190 596 C 250 660 750 660 810 596" fill="none" stroke="${seam}" stroke-width="2" stroke-dasharray="7 5"/>
  </g>
  <circle cx="500" cy="200" r="15" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="2"/>
  <circle cx="496" cy="196" r="5" fill="#fff" fill-opacity="0.25"/>
  <path d="${VISOR_FRONT}" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="2.5"/>
  ${svgClose}`;
}

/* ------------------------------------------------------------------ HAT (side) */

const CROWN_SIDE = `M 226 566 C 196 360 318 226 540 226 C 720 226 792 330 798 520 L 798 566 C 600 602 420 602 226 566 Z`;
const VISOR_SIDE = `M 760 512 C 870 500 962 548 992 604 C 940 618 850 614 766 592 Z`;

function hatSideBase(hex: string) {
  return `${svgOpen()}
  <path d="${CROWN_SIDE}" fill="${hex}"/>
  <path d="${VISOR_SIDE}" fill="${darken(hex, 0.1)}"/>
  <circle cx="540" cy="230" r="13" fill="${darken(hex, 0.1)}"/>
  ${svgClose}`;
}

function hatSideShade(hex: string) {
  const p = "hss";
  const seam = `rgba(0,0,0,0.3)`;
  return `${svgOpen()}
  <defs>
    ${commonDefs(p)}
    <clipPath id="${p}-crown"><path d="${CROWN_SIDE}"/></clipPath>
    <clipPath id="${p}-visor"><path d="${VISOR_SIDE}"/></clipPath>
    <radialGradient id="${p}-dome" cx="0.46" cy="0.3" r="0.7">
      <stop offset="0" stop-color="#fff" stop-opacity="0.2"/>
      <stop offset="0.45" stop-color="#fff" stop-opacity="0.04"/>
      <stop offset="0.8" stop-color="#000" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.5"/>
    </radialGradient>
    <linearGradient id="${p}-visorg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.45"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.1"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.3"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#${p}-crown)">
    <rect x="0" y="0" width="1000" height="1000" fill="url(#${p}-dome)"/>
    <rect x="0" y="0" width="1000" height="1000" fill="url(#${p}-bottom)"/>
    <!-- panel seams: back/side and side/front -->
    <path d="M 534 232 C 420 270 372 410 380 590" fill="none" stroke="${seam}" stroke-width="3"/>
    <path d="M 546 232 C 660 270 690 410 684 594" fill="none" stroke="${seam}" stroke-width="3"/>
    <path d="M 534 232 C 420 270 372 410 380 590" fill="none" stroke="#000" stroke-opacity="0.2" stroke-width="22" filter="url(#${p}-soft)"/>
    <path d="M 546 232 C 660 270 690 410 684 594" fill="none" stroke="#000" stroke-opacity="0.2" stroke-width="22" filter="url(#${p}-soft)"/>
    <!-- back shadow -->
    <ellipse cx="240" cy="470" rx="110" ry="160" fill="url(#${p}-spot)"/>
    <!-- eyelet -->
    <circle cx="530" cy="356" r="7" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="3"/>
    <!-- sweatband line -->
    <path d="M 236 556 C 420 590 600 590 792 556" fill="none" stroke="${seam}" stroke-width="2" stroke-dasharray="7 5"/>
    <rect x="0" y="0" width="1000" height="1000" filter="url(#${p}-grain)" opacity="0.5" style="mix-blend-mode:overlay"/>
  </g>
  <path d="${CROWN_SIDE}" fill="none" stroke="url(#${p}-rim)" stroke-width="2.5"/>
  <g clip-path="url(#${p}-visor)">
    <rect x="0" y="0" width="1000" height="1000" fill="${darken(hex, 0.08)}"/>
    <rect x="0" y="0" width="1000" height="1000" fill="url(#${p}-visorg)"/>
    <path d="M 776 526 C 870 516 946 556 976 598" fill="none" stroke="${seam}" stroke-width="2" stroke-dasharray="7 5"/>
    <path d="M 772 546 C 860 540 926 568 962 604" fill="none" stroke="${seam}" stroke-width="2" stroke-dasharray="7 5"/>
    <rect x="0" y="0" width="1000" height="1000" filter="url(#${p}-grain)" opacity="0.4" style="mix-blend-mode:overlay"/>
  </g>
  <circle cx="540" cy="230" r="13" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="2"/>
  <path d="${VISOR_SIDE}" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="2.5"/>
  ${svgClose}`;
}

/* ------------------------------------------------------------------ registry */

export const BLANKS: Record<BlankId, Blank> = {
  "tee-front": {
    id: "tee-front",
    family: "tee",
    label: "Tee",
    view: "Front",
    printIn: { w: 12, h: 16 },
    placement: { x: 350, y: 326, w: 300, h: 400 },
    base: (hex) => teeBase(hex, false),
    shade: (hex) => teeShade(hex, false),
  },
  "tee-back": {
    id: "tee-back",
    family: "tee",
    label: "Tee",
    view: "Back",
    printIn: { w: 12, h: 16 },
    placement: { x: 350, y: 300, w: 300, h: 400 },
    base: (hex) => teeBase(hex, true),
    shade: (hex) => teeShade(hex, true),
  },
  "hat-front": {
    id: "hat-front",
    family: "hat",
    label: "Cap",
    view: "Front",
    printIn: { w: 4.5, h: 2.25 },
    placement: { x: 320, y: 340, w: 360, h: 180 },
    base: hatFrontBase,
    shade: hatFrontShade,
  },
  "hat-side": {
    id: "hat-side",
    family: "hat",
    label: "Cap",
    view: "Side",
    printIn: { w: 2.5, h: 1.5 },
    placement: { x: 432, y: 380, w: 200, h: 120 },
    base: hatSideBase,
    shade: hatSideShade,
  },
};

export const BLANK_ORDER: BlankId[] = ["tee-front", "tee-back", "hat-front", "hat-side"];

export function blankById(id: BlankId): Blank {
  return BLANKS[id];
}
