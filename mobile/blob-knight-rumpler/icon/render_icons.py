"""Render the launcher icons from foreground.svg + background.svg into android/res.

    python3 icon/render_icons.py

Needs rsvg-convert (brew install librsvg) and Pillow. The PNGs are committed, so
the APK build itself needs neither; rerun this only after editing the SVGs.
"""
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, '..', 'android', 'res')
DENSITIES = {'mdpi': 1.0, 'hdpi': 1.5, 'xhdpi': 2.0, 'xxhdpi': 3.0, 'xxxhdpi': 4.0}


def render(svg, px, out):
    subprocess.run(['rsvg-convert', '-w', str(px), '-h', str(px), svg, '-o', out], check=True)


def main():
    tmp = tempfile.mkdtemp()
    for name, scale in DENSITIES.items():
        d = os.path.join(RES, 'mipmap-' + name)
        os.makedirs(d, exist_ok=True)
        # Adaptive layers: 108dp each (Android 8+ masks them to the device's shape).
        layer = round(108 * scale)
        render(os.path.join(HERE, 'foreground.svg'), layer, os.path.join(d, 'ic_launcher_foreground.png'))
        render(os.path.join(HERE, 'background.svg'), layer, os.path.join(d, 'ic_launcher_background.png'))
        # Legacy icon for Android 7.x: the visible middle 72dp of both layers, as a 48dp rounded square.
        big = 432
        fg = os.path.join(tmp, 'fg.png')
        bg = os.path.join(tmp, 'bg.png')
        render(os.path.join(HERE, 'foreground.svg'), big, fg)
        render(os.path.join(HERE, 'background.svg'), big, bg)
        comp = Image.alpha_composite(Image.open(bg).convert('RGBA'), Image.open(fg).convert('RGBA'))
        inner = big * 72 // 108
        off = (big - inner) // 2
        comp = comp.crop((off, off, off + inner, off + inner))
        mask = Image.new('L', comp.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner - 1, inner - 1), radius=inner * 0.2, fill=255)
        legacy = Image.new('RGBA', comp.size, (0, 0, 0, 0))
        legacy.paste(comp, (0, 0), mask)
        legacy.resize((round(48 * scale),) * 2, Image.LANCZOS).save(os.path.join(d, 'ic_launcher.png'))
    print('icons written to', os.path.normpath(RES))


if __name__ == '__main__':
    main()
