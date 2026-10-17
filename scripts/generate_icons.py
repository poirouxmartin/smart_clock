"""Régénère les icônes Aube : assets Expo et mipmaps Android.

Dépendance : Pillow uniquement. Usage : python scripts/generate_icons.py
Dessin sur 4096 px (supersampling x4), réduction LANCZOS pour l'antialiasing.
Coordonnées ci-dessous exprimées sur une grille 1024.
"""
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SS = 4
CANVAS = 1024 * SS
LAUNCHER = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
BG_STOPS = [(0.0, "#141a3a"), (0.55, "#5b3a72"), (1.0, "#f2895a")]
CREAM = (0xFF, 0xF3, 0xE0)


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def lerp_stops(stops, t):
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1:
            k = 0 if t1 == t0 else (t - t0) / (t1 - t0)
            return tuple(round(a + (b - a) * k) for a, b in zip(c0, c1))
    return stops[-1][1]


def gradient(width, height, stops):
    """Dégradé vertical RGB ; stops = [(t, '#hex')], t dans [0, 1]."""
    rgb_stops = [(t, hex_rgb(c)) for t, c in stops]
    img = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / (height - 1)
        draw.line([(0, y), (width, y)], fill=lerp_stops(rgb_stops, t))
    return img


def background():
    return gradient(CANVAS, CANVAS, BG_STOPS).convert("RGBA")


def rounded_line(draw, x1, y1, x2, y2, width, fill):
    """Trait épais à bouts arrondis ; coordonnées sur grille 1024."""
    w = width * SS
    draw.line([(x1 * SS, y1 * SS), (x2 * SS, y2 * SS)], fill=fill, width=w)
    r = w / 2
    for x, y in ((x1, y1), (x2, y2)):
        cx, cy = x * SS, y * SS
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)


def draw_sun():
    """Demi-disque (y <= 600) avec dégradé, centre (512, 600), rayon 190."""
    grad = gradient(CANVAS, 190 * SS, [(0, "#ffe08a"), (1, "#ffb04a")])
    rgb = Image.new("RGB", (CANVAS, CANVAS))
    rgb.paste(grad, (0, 410 * SS))
    mask = Image.new("L", (CANVAS, CANVAS), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse([(512 - 190) * SS, (600 - 190) * SS,
                       (512 + 190) * SS, (600 + 190) * SS], fill=255)
    mask_draw.rectangle([0, 600 * SS, CANVAS, CANVAS], fill=0)
    sun = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    sun.paste(rgb.convert("RGBA"), (0, 0), mask)
    return sun


def draw_foreground():
    fg = draw_sun()
    draw = ImageDraw.Draw(fg)
    ray_color = hex_rgb("#ffd27a") + (255,)
    for deg in (30, 60, 90, 120, 150):
        a = math.radians(deg)
        x1, y1 = 512 + 235 * math.cos(a), 600 - 235 * math.sin(a)
        x2, y2 = 512 + 300 * math.cos(a), 600 - 300 * math.sin(a)
        rounded_line(draw, x1, y1, x2, y2, 34, ray_color)
    rounded_line(draw, 262, 600, 762, 600, 30, CREAM + (255,))
    rounded_line(draw, 362, 672, 662, 672, 24, CREAM + (150,))
    rounded_line(draw, 437, 736, 587, 736, 24, CREAM + (110,))
    return fg


def make_mono(fg):
    mono = Image.new("RGBA", fg.size, (255, 255, 255, 255))
    mono.putalpha(fg.getchannel("A"))
    return mono


def circle_mask():
    mask = Image.new("L", (CANVAS, CANVAS), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, CANVAS - 1, CANVAS - 1], fill=255)
    return mask


def save(img, path, size):
    path.parent.mkdir(parents=True, exist_ok=True)
    out = img.resize((size, size), Image.Resampling.LANCZOS)
    if path.suffix == ".webp":
        out.save(path, "WEBP", lossless=True)
    else:
        out.save(path, "PNG")
    print(f"{path.relative_to(ROOT)} {size}x{size}")


def save_splash(fg, path):
    with Image.open(path) as existing:
        size = existing.size
    out = fg.resize(size, Image.Resampling.LANCZOS)
    out.save(path, "PNG")
    print(f"{path.relative_to(ROOT)} {size[0]}x{size[1]}")


def main():
    bg = background()
    fg = draw_foreground()
    full = bg.copy()
    full.alpha_composite(fg)
    round_icon = full.copy()
    round_icon.putalpha(ImageChops.multiply(full.getchannel("A"), circle_mask()))
    mono = make_mono(fg)

    assets = ROOT / "assets"
    save(full, assets / "icon.png", 1024)
    save(fg, assets / "adaptive-icon.png", 1024)
    save(mono, assets / "adaptive-icon-mono.png", 1024)
    save(bg, assets / "adaptive-icon-background.png", 1024)
    save(full, assets / "favicon.png", 64)
    save(fg, assets / "splash.png", 1024)
    save(fg, assets / "splash-icon.png", 1024)

    res = ROOT / "android" / "app" / "src" / "main" / "res"
    for density, px in LAUNCHER.items():
        d = res / f"mipmap-{density}"
        save(full, d / "ic_launcher.webp", px)
        save(round_icon, d / "ic_launcher_round.webp", px)
    for density, px in ADAPTIVE.items():
        d = res / f"mipmap-{density}"
        save(fg, d / "ic_launcher_foreground.webp", px)
        save(mono, d / "ic_launcher_monochrome.webp", px)
        save(bg, d / "ic_launcher_background.webp", px)

    for path in sorted(res.glob("drawable*/splashscreen_logo.png")):
        save_splash(fg, path)


if __name__ == "__main__":
    main()
