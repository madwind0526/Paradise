"""Composes the store images: a real app screenshot inside a phone frame over a Krea 2 anime backdrop, with a headline.
Usage: python scripts/store-mockup.py  (reads store/gen/bg-*.png and store/screenshots/*.png, writes store/promo/*.png and store/feature-1024x500.png)"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 720, 1280
FONT = "C:/Windows/Fonts/segoeui.ttf"
FONT_B = "C:/Windows/Fonts/segoeuib.ttf"
FONT_L = "C:/Windows/Fonts/segoeuil.ttf"
ITEMS = [
    ("lagoon", "lagoon", "day-01-maldives", "Unwind by the Sea", "A calm anime beach that follows the hour"),
    ("sunset", "sunset", "eve-01-bali", "Float Away", "Ride a balloon, a carpet or a cloud"),
    ("beaches", "lagoon", "day-02-hawaii", "Six Beaches, Ten Friends", "Pick your beach and your seat"),
    ("aurora", "aurora", "night-01-halong", "Under the Aurora", "A round moon, stars and northern lights"),
]


def cover(img, w, h):
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def shade(img, box, alpha_top, alpha_bottom, vertical=True):
    """A soft dark gradient over `box`, so white text stays readable on a bright picture."""
    x0, y0, x1, y1 = box
    g = Image.new("L", (x1 - x0, y1 - y0))
    px = g.load()
    n = (y1 - y0) if vertical else (x1 - x0)
    for i in range(n):
        a = round(alpha_top + (alpha_bottom - alpha_top) * i / max(1, n - 1))
        for j in range((x1 - x0) if vertical else (y1 - y0)):
            px[(j, i) if vertical else (i, j)] = a
    img.paste(Image.new("RGB", g.size, (8, 14, 36)), (x0, y0), g)


def text(d, xy, s, font, anchor="mm"):
    d.text((xy[0], xy[1] + 2), s, font=font, fill=(0, 0, 0), anchor=anchor)  # soft drop shadow
    d.text(xy, s, font=font, fill="white", anchor=anchor)


def fit(d, s, path, size, max_w):
    while size > 20 and d.textlength(s, font=ImageFont.truetype(path, size)) > max_w:
        size -= 2
    return ImageFont.truetype(path, size)


def phone(bg, shot, x0, y0, sw, bez, radius):
    sh = round(sw * 1280 / 720)
    shot = shot.convert("RGB").resize((sw, sh), Image.LANCZOS)
    pw, ph = sw + 2 * bez, sh + 2 * bez
    sh_layer = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh_layer).rounded_rectangle((x0, y0 + 14, x0 + pw, y0 + ph + 14), radius, fill=(0, 0, 0, 120))
    sh_layer = sh_layer.filter(ImageFilter.GaussianBlur(18))
    bg.paste(sh_layer, (0, 0), sh_layer)
    d = ImageDraw.Draw(bg)
    d.rounded_rectangle((x0, y0, x0 + pw, y0 + ph), radius, fill=(14, 14, 18), outline=(70, 70, 78), width=2)
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw, sh), max(8, radius // 3), fill=255)
    bg.paste(shot, (x0 + bez, y0 + bez), mask)


for key, bgname, shotname, head, sub in ITEMS:
    bg = cover(Image.open(f"store/gen/bg-{bgname}.png").convert("RGB"), W, H)
    shade(bg, (0, 0, W, 300), 120, 0)
    d = ImageDraw.Draw(bg)
    text(d, (W / 2, 92), head, fit(d, head, FONT_B, 54, W - 80))
    text(d, (W / 2, 150), sub, fit(d, sub, FONT, 26, W - 80))
    sw, bez = 540, 26
    phone(bg, Image.open(f"store/screenshots/{shotname}.png"), (W - sw - 2 * bez) // 2, 190, sw, bez, 56)
    bg.save(f"store/promo/promo-{key}-720x1280.png")
    print("wrote", key)

# Feature graphic 1024x500: title and tagline on the left, three phones on the right.
FW, FH = 1024, 500
fg = cover(Image.open("store/gen/bg-wide.png").convert("RGB"), FW, FH)
shade(fg, (0, 0, 560, FH), 150, 0, vertical=False)
d = ImageDraw.Draw(fg)
text(d, (60, 190), "Paradise", ImageFont.truetype(FONT_B, 92), "lm")
text(d, (62, 266), "Relax. Float. Breathe.", ImageFont.truetype(FONT_L, 38), "lm")
text(d, (62, 320), "An anime beach that follows the hour", ImageFont.truetype(FONT, 20), "lm")
for i, (name, x) in enumerate([("day-01-maldives", 470), ("eve-01-bali", 650), ("night-01-halong", 830)]):
    phone(fg, Image.open(f"store/screenshots/{name}.png"), x, 100 if i != 1 else 80, 150, 11, 26)
fg.save("store/feature-1024x500.png")
print("wrote feature")
