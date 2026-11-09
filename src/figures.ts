import { asset } from "./config";

// The picture the player chooses: a person seen from behind on a seat of the sky. Each is an image with a transparent
// background in public/figures. Pictures dropped into that folder are offered too (see registerFigures).
// head: the person's head in the picture as [x, y, diameter] (fractions of the square picture), bottom: the lowest row of the drawing.
// The world uses them to put the person of every figure where the person of the sun lounger sits, and to keep the drawing above the sand.
// A picture without them (one you drop into public/figures) is only placed on the ground line.
export interface FigureLook { head?: [number, number, number]; bottom?: number; floats: boolean }
export interface Figure extends FigureLook { id: string; name: string; file: string }

const LOOK: Record<string, Omit<FigureLook, "floats">> = {
  sunbed: { head: [0.55, 0.23, 0.30], bottom: 0.92 },
  cloud: { head: [0.48, 0.23, 0.37], bottom: 0.98 },
  carpet: { head: [0.50, 0.19, 0.33], bottom: 0.93 },
  drone: { head: [0.50, 0.20, 0.28], bottom: 0.92 },
  balloon: { head: [0.48, 0.68, 0.12], bottom: 0.98 },
  swing: { head: [0.50, 0.57, 0.22], bottom: 0.98 },
  boat: { head: [0.42, 0.40, 0.31], bottom: 0.98 },
  whale: { head: [0.50, 0.15, 0.27], bottom: 0.97 },
  swan: { head: [0.55, 0.32, 0.30], bottom: 0.98 },
  surfboard: { head: [0.47, 0.20, 0.35], bottom: 0.95 },
};

const NAMES: Record<string, string> = {
  sunbed: "선베드", cloud: "구름", carpet: "양탄자", drone: "드론", balloon: "열기구", swing: "그네", boat: "돛단배", whale: "고래", swan: "백조 튜브", surfboard: "서핑보드",
};
const figure = (file: string): Figure => {
  const id = file.replace(/\.(png|webp)$/i, "");
  // Everything except the sun lounger floats and sways; it stands on the sand.
  return { id, name: NAMES[id] ?? id.replace(/[_-]+/g, " "), file: asset("/figures/") + encodeURIComponent(file), floats: id !== "sunbed", ...LOOK[id] };
};

export const FIGURES: Figure[] = Object.keys(NAMES).map((id) => figure(id + ".webp"));
export const defaultFigure = () => FIGURES[0].id;

/** Offers the pictures the server (or the app index) found in public/figures, in place of the bundled list. */
export function registerFigures(files: string[]) {
  if (files.length) FIGURES.splice(0, FIGURES.length, ...files.map(figure));
}
