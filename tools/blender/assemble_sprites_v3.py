# Assemble les frames v3 en spritesheets {race}_{classe}.png + atlas JSON
# (MEME schema que les anciennes planches {classe}.png : cell 160, rows).
# /usr/local/bin/python3 assemble_sprites_v3.py [race_classe ...]
import json
import os
import sys
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, 'out', 'sprites_v3')
DEST = os.path.join(BASE, '..', '..', 'public', 'assets', 'sprites')
CELL = 160
DIRS = ['S', 'E', 'N', 'W']
ANIMS = [('idle', 2), ('walk', 4), ('attack', 4), ('hit', 1), ('death', 2)]
RACES = ['humain', 'elfe', 'nain', 'orc', 'gobelin', 'drakeide']
CLASSES = ['colosse', 'bretteur', 'roublard', 'lancier', 'mage', 'berserker']

args = sys.argv[1:]
pairs = [tuple(a.rsplit('_', 1)) for a in args] if args else \
    [(r, c) for r in RACES for c in CLASSES]

os.makedirs(DEST, exist_ok=True)
done = 0
for race, cls in pairs:
    name = '%s_%s' % (race, cls)
    src = os.path.join(OUT, name)
    anims = ANIMS + ([('cast', 4)] if cls == 'mage' else [])
    missing = [
        '%s_%s_%d.png' % (d, a, f)
        for d in DIRS for a, n in anims for f in range(n)
        if not os.path.exists(os.path.join(src, '%s_%s_%d.png' % (d, a, f)))
    ]
    if missing:
        print('SKIP %s : %d frames manquantes (ex %s)' % (name, len(missing), missing[0]))
        continue
    n_rows = len(DIRS) * len(anims)
    max_f = max(n for _, n in anims)
    sheet = Image.new('RGBA', (CELL * max_f, CELL * n_rows), (0, 0, 0, 0))
    rows = []
    row = 0
    for d in DIRS:
        for aname, n in anims:
            for f in range(n):
                img = Image.open(os.path.join(src, '%s_%s_%d.png' % (d, aname, f))).convert('RGBA')
                sheet.paste(img, (f * CELL, row * CELL))
            rows.append({'dir': d, 'anim': aname, 'row': row, 'frames': n})
            row += 1
    sheet.save(os.path.join(DEST, name + '.png'), optimize=True)
    with open(os.path.join(DEST, name + '.json'), 'w') as f:
        json.dump({'cell': CELL, 'rows': rows}, f)
    done += 1
    print('SHEET', name, sheet.size)
print('ASSEMBLAGE V3 OK (%d planches)' % done)
