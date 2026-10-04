// Core design model. All layer geometry is stored in PRINT PIXELS at 300 DPI,
// with the origin at the top-left of the blank's print area. That makes the
// print-file export a 1:1 draw and keeps the editor a pure projection.

export type BlankId = "tee-front" | "tee-back" | "hat-front" | "hat-side";

export type LayerKind = "image" | "text";

export interface LayerBase {
  id: string;
  kind: LayerKind;
  name: string;
  /** Center of the layer in print px. */
  x: number;
  y: number;
  /** Intrinsic size in print px before scale. */
  naturalW: number;
  naturalH: number;
  scale: number;
  /** Degrees, clockwise. */
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface ImageLayer extends LayerBase {
  kind: "image";
  /** data: URL (unsaved) or https URL (uploaded to storage). */
  src: string;
}

export interface TextLayer extends LayerBase {
  kind: "text";
  text: string;
  fontFamily: string;
  fontWeight: number;
  /** Font size in print px (300 px = 1 inch). */
  fontSize: number;
  color: string;
  letterSpacing: number; // em units
  lineHeight: number; // multiplier
  align: "left" | "center" | "right";
  strokeWidth: number; // print px
  strokeColor: string;
  uppercase: boolean;
}

export type Layer = ImageLayer | TextLayer;

export interface Design {
  id: string;
  name: string;
  blank: BlankId;
  color: string; // garment color id
  layers: Layer[]; // bottom -> top
  updatedAt: string;
}

export interface GarmentColor {
  id: string;
  name: string;
  hex: string;
  /** Pick a light or dark default ink for new text. */
  dark: boolean;
}

export interface Blank {
  id: BlankId;
  family: "tee" | "hat";
  label: string;
  view: string;
  /** Print area in inches. */
  printIn: { w: number; h: number };
  /** Where the print area sits in the 1000x1000 garment viewBox. */
  placement: { x: number; y: number; w: number; h: number };
  /** Garment artwork, split so layers render between base and shading. */
  base: (hex: string) => string;
  shade: (hex: string) => string;
}

export const DPI = 300;
export const VIEW = 1000; // garment viewBox is 0..1000 square

export function printPx(blank: Blank) {
  return { w: Math.round(blank.printIn.w * DPI), h: Math.round(blank.printIn.h * DPI) };
}

/** Scale factor from print px to viewBox units for a blank. */
export function printToView(blank: Blank) {
  return blank.placement.w / (blank.printIn.w * DPI);
}

export function uid(prefix = "l") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
