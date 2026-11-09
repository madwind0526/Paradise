export interface MapSpec {
  schema: string; id?: string; name: string; author: string;
  thumb?: string; // card picture: a bundled path (built-in maps) or a small JPEG data URL (added maps)
  sky: { clouds: number; stars: number; haze: number; blue: number; nightPhotos: string; picture: string; hour: number };
  scenery: { photo: string; stand: number; cloud: string }; // photo: a panorama under /resorts/; stand: the row of the picture (0 top .. 1 bottom) where the figure stands, on the sand; cloud: color of the cloud deck
  ambience: { wind: number; birds: number; insects: number };
}
