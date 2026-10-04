import type { GarmentColor } from "./types";

export const GARMENT_COLORS: GarmentColor[] = [
  { id: "black", name: "Jet Black", hex: "#141417", dark: true },
  { id: "charcoal", name: "Charcoal", hex: "#34363c", dark: true },
  { id: "heather", name: "Heather Grey", hex: "#8d9097", dark: false },
  { id: "white", name: "Optic White", hex: "#f3f1ec", dark: false },
  { id: "cream", name: "Bone", hex: "#e8dfcc", dark: false },
  { id: "sand", name: "Sand", hex: "#c9b48c", dark: false },
  { id: "navy", name: "Midnight Navy", hex: "#1a2238", dark: true },
  { id: "royal", name: "Royal", hex: "#2446b8", dark: true },
  { id: "sky", name: "Sky", hex: "#9cc3e6", dark: false },
  { id: "forest", name: "Forest", hex: "#1f4a36", dark: true },
  { id: "olive", name: "Olive", hex: "#5d5f3a", dark: true },
  { id: "burgundy", name: "Burgundy", hex: "#5b1b2a", dark: true },
  { id: "red", name: "Signal Red", hex: "#c8202f", dark: true },
  { id: "orange", name: "Safety Orange", hex: "#e8651a", dark: true },
  { id: "mustard", name: "Mustard", hex: "#d9a21b", dark: false },
  { id: "violet", name: "Ultraviolet", hex: "#4b2a8f", dark: true },
];

export function colorById(id: string): GarmentColor {
  return GARMENT_COLORS.find((c) => c.id === id) ?? GARMENT_COLORS[0];
}

export const INK_PRESETS = [
  "#ffffff", "#0a0a0a", "#f5c542", "#ff4d6d", "#7c5cff", "#2dd4bf", "#60a5fa", "#f97316", "#a3e635", "#e879f9",
];
