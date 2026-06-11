# Génère les PNG normal/roughness/metallic depuis les valeurs uniformes mesurées
# (nos matériaux procéduraux sont plats hors albedo). /usr/local/bin/python3 finaliser_pbr.py
import os

from PIL import Image

TEX = '/home/user/Gladiators-Manager/assets3d/textures'
n = 0
for f in sorted(os.listdir(TEX)):
    if not f.endswith('_pbr.txt'):
        continue
    base = f[:-8]
    vals = {}
    with open(os.path.join(TEX, f)) as fh:
        for ligne in fh:
            k, v = ligne.strip().split('=')
            vals[k] = float(v)
    g_r = int(round(vals.get('roughness', 0.6) * 255))
    g_m = int(round(vals.get('metallic', 0.0) * 255))
    Image.new('RGB', (512, 512), (128, 128, 255)).save(os.path.join(TEX, base + '_normal.png'))
    Image.new('L', (512, 512), g_r).save(os.path.join(TEX, base + '_roughness.png'))
    Image.new('L', (512, 512), g_m).save(os.path.join(TEX, base + '_metallic.png'))
    n += 1
print('PBR finalisé pour %d assets' % n)
