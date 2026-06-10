# Assemble les frames individuelles en spritesheets + atlas JSON.
# /usr/local/bin/python3 assemble_sprites.py
import json
import os
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, 'out', 'sprites')
DEST = os.path.join(BASE, '..', '..', 'public', 'assets', 'sprites')
CELL = 128
DIRS = ['S', 'E', 'N', 'W']
ANIMS = [('idle', 2), ('walk', 4), ('attack', 4), ('hit', 1), ('death', 2)]
CLASSES = ['colosse', 'bretteur', 'roublard', 'lancier', 'mage', 'berserker']

os.makedirs(DEST, exist_ok=True)
for cls in CLASSES:
    anims = ANIMS + ([('cast', 4)] if cls == 'mage' else [])
    n_rows = len(DIRS) * len(anims)
    max_f = max(n for _, n in anims)
    sheet = Image.new('RGBA', (CELL * max_f, CELL * n_rows), (0, 0, 0, 0))
    rows = []
    row = 0
    for d in DIRS:
        for aname, n in anims:
            for f in range(n):
                p = os.path.join(OUT, cls, '%s_%s_%d.png' % (d, aname, f))
                img = Image.open(p).convert('RGBA')
                sheet.paste(img, (f * CELL, row * CELL))
            rows.append({'dir': d, 'anim': aname, 'row': row, 'frames': n})
            row += 1
    sheet.save(os.path.join(DEST, cls + '.png'), optimize=True)
    with open(os.path.join(DEST, cls + '.json'), 'w') as f:
        json.dump({'cell': CELL, 'rows': rows}, f)
    print('SHEET', cls, sheet.size)
print('ASSEMBLAGE OK')
