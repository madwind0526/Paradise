// Played when the user playlist is empty: a YouTube playlist/video link or any direct audio URL.
export const DEFAULT_TRACK = "https://www.youtube.com/watch?v=1t39vq3LdRs&list=PLCqwmfitbQCY";

// "Buy me a coffee" page opened by the coffee button in the profile pop-up.
export const SUPPORT_URL = "https://buymeacoffee.com/madwind052i";

// Prefix for files under public/ when the app is served from a sub-path.
export const asset = (p: string) => import.meta.env.BASE_URL + p.replace(/^\//, "");
