# Rendu par lot v3 : sprites de combat (race x classe), genre m, variant 0.
# Reprise possible : les frames deja rendues sont sautees.
# /opt/blender/blender -b -P render_sprites_v3.py -- [race_classe ...]
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gmlib as G

DIRS = [('S', 0), ('E', 90), ('N', 180), ('W', 270)]
ANIMS = [('idle', 2), ('walk', 4), ('attack', 4), ('hit', 1), ('death', 2)]
OUTD = G.OUT + '/sprites_v3'


def corp_for(cls, race):
    if cls in ('colosse', 'berserker'):
        return 2
    if cls == 'roublard' or race == 'gobelin':
        return 0
    return 1


args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if args:
    pairs = [tuple(a.rsplit('_', 1)) for a in args]
else:
    pairs = [(r, c) for r in G.RACE_LIST for c in G.CLASSES.keys()]

t0 = time.time()
total = skipped = 0
for race, cls in pairs:
    d = '%s/%s_%s' % (OUTD, race, cls)
    os.makedirs(d, exist_ok=True)
    anims = ANIMS + ([('cast', 4)] if cls == 'mage' else [])
    todo = []
    for dname, ddeg in DIRS:
        for aname, nf in anims:
            for f in range(nf):
                p = '%s/%s_%s_%d.png' % (d, dname, aname, f)
                if os.path.exists(p):
                    skipped += 1
                else:
                    todo.append((dname, ddeg, aname, f, p))
    if not todo:
        print('PAIRE %s_%s deja complete, saut' % (race, cls), flush=True)
        continue
    G.reset_scene()
    G.setup_render(res_x=160, res_y=160, samples=28, transparent=True)
    rig = G.build_character(cls, race=race, genre='m',
                            corpulence=corp_for(cls, race), variant=0)
    G.sprite_stage(ortho_scale=rig['ortho'], target_z=0.62 * rig['s'] + 0.35)
    for dname, ddeg, aname, f, p in todo:
        G.apply_pose(rig, G.get_pose(cls, aname, f), direction_deg=ddeg)
        G.render_to(p)
        total += 1
    print('PAIRE %s_%s OK (%d rendus cumules, %d sautes, %.0fs)' %
          (race, cls, total, skipped, time.time() - t0), flush=True)
print('SPRITES V3 TERMINE %d rendus (%d sautes) en %.0fs' % (total, skipped, time.time() - t0))
