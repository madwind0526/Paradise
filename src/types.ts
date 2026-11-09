export interface MapSpec {
  schema: string; id?: string; name: string; author: string;
  thumb?: string; // card picture: a bundled path (built-in maps) or a small JPEG data URL (added maps)
  sky: { clouds: number; stars: number; haze: number; blue: number; nightPhotos: string; picture: string; hour: number };
  scenery: { photo: string; mountains: "" | "blue" | "snow" | "rock" | "forest" | "green"; horizon: number; cloud: string }; // photo: a panorama under /resorts/; horizon: where its horizon sits, 0 (top) to 1 (bottom); cloud: color of the cloud deck
  ambience: { wind: number; birds: number; insects: number };
}
