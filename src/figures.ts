import { asset } from "./config";

// The picture the player chooses: a person seen from behind on a seat of the sky. Each is an image with a transparent
// background in public/figures. Pictures dropped into that folder are offered too (see registerFigures).
export interface Figure { id: string; name: string; file: string }

const NAMES: Record<string, string> = {
  sunbed: "선베드", cloud: "구름", carpet: "양탄자", drone: "드론", balloon: "열기구", swing: "그네", boat: "돛단배", whale: "고래", swan: "백조 튜브", surfboard: "서핑보드",
};
const figure = (file: string): Figure => {
  const id = file.replace(/\.(png|webp)$/i, "");
  return { id, name: NAMES[id] ?? id.replace(/[_-]+/g, " "), file: asset("/figures/") + encodeURIComponent(file) };
};

export const FIGURES: Figure[] = Object.keys(NAMES).map((id) => figure(id + ".webp"));
export const defaultFigure = () => FIGURES[0].id;

/** Offers the pictures the server (or the app index) found in public/figures, in place of the bundled list. */
export function registerFigures(files: string[]) {
  if (files.length) FIGURES.splice(0, FIGURES.length, ...files.map(figure));
}
