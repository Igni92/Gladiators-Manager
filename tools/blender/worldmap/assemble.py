# -*- coding: utf-8 -*-
"""Assemblage PIL : brume de profondeur (dégradé), composition des couches,
publication vers public/assets/monde/, planche de contrôle des props.

Usage (/usr/local/bin/python3) :
  assemble.py preview            -> out/preview.png + out/debug_lieux.png
  assemble.py compose [publish]  -> carte_fond/milieu/premier + carte (out/ ou monde/)
  assemble.py props              -> out/props_sheet.png (planche contact)
"""
import json
import os
import sys

from PIL import Image, ImageChops, ImageDraw

WM = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(WM, 'out')
MONDE = '/home/user/Gladiators-Manager/public/assets/monde'

FOG_RGB = (233, 230, 220)        # PAL['brume']
FOG_TOP = 0.62                   # opacité de la brume tout en haut
FOG_LIMIT = 0.52                 # la brume s'annule à 52 % de la hauteur
FOG_GAMMA = 1.7


def fog_gradient(w, h):
    """Image L : alpha de brume par ligne (fort en haut, nul vers le bas)."""
    col = Image.new('L', (1, h))
    px = []
    for y in range(h):
        yn = y / max(h - 1, 1)
        t = max(0.0, (FOG_LIMIT - yn) / FOG_LIMIT)
        px.append(int(255 * FOG_TOP * (t ** FOG_GAMMA)))
    col.putdata(px)
    return col.resize((w, h), Image.NEAREST)


def apply_fog_opaque(img):
    img = img.convert('RGBA')
    grad = fog_gradient(*img.size)
    fog = Image.new('RGBA', img.size, FOG_RGB + (0,))
    fog.putalpha(grad)
    return Image.alpha_composite(img, fog)


def apply_fog_alpha(img):
    """Brume sur RGB uniquement, alpha d'origine conservé (couches alpha)."""
    img = img.convert('RGBA')
    a0 = img.getchannel('A')
    grad = fog_gradient(*img.size)
    fog = Image.new('RGBA', img.size, FOG_RGB + (0,))
    fog.putalpha(ImageChops.multiply(grad, a0))
    out = Image.alpha_composite(img, fog)
    out.putalpha(a0)
    return out


def overlay_lieux(img, lieux_path, dest):
    img = img.convert('RGBA')
    d = ImageDraw.Draw(img)
    W_, H_ = img.size
    with open(lieux_path, encoding='utf-8') as f:
        lieux = json.load(f)
    for l in lieux:
        x, y = l['x'] * W_, l['y'] * H_
        r = max(4, W_ // 110)
        d.ellipse((x - r, y - r, x + r, y + r), outline=(255, 30, 30, 255), width=2)
        d.line((x - r * 2, y, x + r * 2, y), fill=(255, 30, 30, 255), width=1)
        d.line((x, y - r * 2, x, y + r * 2), fill=(255, 30, 30, 255), width=1)
        d.text((x + r + 2, y - r - 2), l['id'], fill=(255, 255, 255, 255))
    img.save(dest)
    print('debug lieux -> %s' % dest)


def do_preview():
    raw = Image.open(os.path.join(OUT, 'raw_preview.png'))
    out = apply_fog_opaque(raw).convert('RGB')
    p = os.path.join(OUT, 'preview.png')
    out.save(p)
    print('preview -> %s' % p)
    lj = os.path.join(OUT, 'lieux_raw.json')
    if os.path.exists(lj):
        overlay_lieux(out, lj, os.path.join(OUT, 'debug_lieux.png'))


def do_compose(publish=False):
    dest = MONDE if publish else OUT
    fond = apply_fog_opaque(Image.open(os.path.join(OUT, 'raw_fond.png')))
    milieu = apply_fog_alpha(Image.open(os.path.join(OUT, 'raw_milieu.png')))
    premier = Image.open(os.path.join(OUT, 'raw_premier.png')).convert('RGBA')

    fond.convert('RGB').save(os.path.join(dest, 'carte_fond.png'))
    milieu.save(os.path.join(dest, 'carte_milieu.png'))
    premier.save(os.path.join(dest, 'carte_premier.png'))

    carte = Image.alpha_composite(Image.alpha_composite(fond, milieu), premier)
    carte.convert('RGB').save(os.path.join(dest, 'carte.png'))
    print('couches + carte -> %s (%dx%d)' % (dest, *carte.size))

    if publish:
        src = os.path.join(OUT, 'lieux_raw.json')
        with open(src, encoding='utf-8') as f:
            lieux = json.load(f)
        with open(os.path.join(MONDE, 'lieux.json'), 'w', encoding='utf-8') as f:
            json.dump(lieux, f, ensure_ascii=False, indent=2)
        print('lieux.json -> %s' % MONDE)
    overlay_lieux(carte, os.path.join(OUT, 'lieux_raw.json'),
                  os.path.join(OUT, 'debug_lieux.png'))


def do_props():
    pdir = os.path.join(MONDE, 'props')
    names = sorted(f for f in os.listdir(pdir) if f.endswith('.png'))
    if not names:
        print('aucun prop'); return
    cell = 280
    cols = 4
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * (cell + 18)), (70, 80, 95, 255))
    d = ImageDraw.Draw(sheet)
    for i, n in enumerate(names):
        im = Image.open(os.path.join(pdir, n)).convert('RGBA')
        im.thumbnail((cell - 12, cell - 12))
        x = (i % cols) * cell
        y = (i // cols) * (cell + 18)
        sheet.alpha_composite(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
        d.text((x + 8, y + cell - 2), n, fill=(255, 255, 255, 255))
    p = os.path.join(OUT, 'props_sheet.png')
    sheet.save(p)
    print('planche props -> %s' % p)


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    if mode == 'preview':
        do_preview()
    elif mode == 'compose':
        do_compose(publish='publish' in sys.argv)
    elif mode == 'props':
        do_props()
    else:
        raise SystemExit('mode inconnu: %s' % mode)
