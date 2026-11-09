# MAP PICTURE, step 3 of 3. Run:  python 3-cut-sky.py anime_m anime_out maldives hawaii   -> anime_out/<name>.webp (copy to public/resorts).
# Cut the sky out of a panorama whose sky Qwen Image Edit replaced with flat magenta (#ff00ff).
# Magenta is used (not green) because the scenery is full of green leaves. The matte is soft, so leaf edges stay clean.
import sys, os, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi

REPAIR = {"hawaii"}                                                 # pictures where Qwen painted magenta patches on the scenery itself (a mountain peak): repaired below
STRICT = {"bali"}                                                   # pictures whose far haze is magenta-tinted: cut less so that the distant volcano stays

def key(path, name=""):
    strict = name in STRICT
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    lo = np.minimum(R, B)
    ratio = (lo - G) / np.maximum(lo, 90.0)                        # 1 for pure magenta, <= 0 for leaves, sea and sand
    cand = ratio > (0.55 if strict else 0.45)
    lab, n = ndi.label(cand)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sky = np.isin(lab, list(edge))                                  # magenta that reaches the picture edge (the sky, and the gaps between leaves it shows through)
    # gaps between leaves that the sky shows through are separate magenta pieces right next to the sky: they are sky too.
    # A piece far from the sky (a magenta patch Qwen painted on a mountain peak) is not sky: it is repaired below.
    near_sky = ndi.binary_dilation(sky, iterations=10)
    sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
    for i, v in enumerate(sizes, 1):
        if v > (150 if strict else 40) and ratio[lab == i].mean() > (0.8 if strict else 0.6) and (near_sky[lab == i].any() or name not in REPAIR):
            sky |= lab == i
    region = ndi.binary_dilation(sky, iterations=3)                 # the sky plus its anti-aliased rim
    alpha = np.where(region, 1.0 - np.clip(((ratio - 0.25) / 0.6 if strict else (ratio - 0.12) / 0.5), 0, 1), 1.0)
    alpha = np.clip(alpha, 0, 1)
    # remove the magenta from partly covered pixels: C = a*F + (1-a)*M  =>  F = (C - (1-a)*M) / a
    M = np.array([255.0, 0.0, 255.0])
    edge_px = region & (alpha > 0.02) & (alpha < 0.98)
    al = np.clip(alpha, 0.25, 1.0)[..., None]
    f = a.copy()
    f[edge_px] = ((a - (1 - al) * M) / al)[edge_px]
    # no pink rim: inside a narrow band along the cut, take the color of the nearest pixel that is clearly away from the sky
    band = ndi.binary_dilation(sky, iterations=5)
    idx = ndi.distance_transform_edt(band, return_distances=False, return_indices=True)
    f[band] = f[idx[0], idx[1]][band]
    # stray magenta (not sky): replace it by the color of the nearest clean pixel
    stray = (ratio > 0.5) & (lo > 140) & ~band & ~sky & (name in REPAIR)   # Qwen's paint on a peak is often a paler pink than the sky              # only bright, saturated magenta: dark purple shadows are real
    stray = ndi.binary_dilation(stray, iterations=2) & ~sky
    if stray.any():
        clean = ~stray & ~sky
        idx2 = ndi.distance_transform_edt(~clean, return_distances=False, return_indices=True)
        f[stray] = f[idx2[0], idx2[1]][stray]
    return f.clip(0, 255).astype(np.uint8), alpha

if __name__ == "__main__":
    src, out, names = sys.argv[1], sys.argv[2], sys.argv[3:]
    for n in names:
        rgb, alpha = key(f"{src}/{n}.png", n)
        im = Image.fromarray(np.dstack([rgb, (alpha * 255).astype(np.uint8)]), "RGBA")
        im.save(f"{out}/{n}.webp", quality=90, method=6)
        bg = Image.new("RGBA", im.size, (60, 110, 200, 255)); bg.alpha_composite(im)
        bg.convert("RGB").resize((448, 192)).save(f"{src}/_check_{n}.jpg", quality=85)
        print(n, "ok", im.size)
