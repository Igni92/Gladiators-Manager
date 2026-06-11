# Rendu par lot des sprites de combat : 6 classes x 4 directions x animations.
# /opt/blender/blender -b -P render_sprites.py -- [classe ...]
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gmlib as G
import bpy

DIRS = [('S', 0), ('E', 90), ('N', 180), ('W', 270)]
ANIMS = [('idle', 2), ('walk', 4), ('attack', 4), ('hit', 1), ('death', 2)]
OUTD = G.OUT + '/sprites'

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
classes = args if args else list(G.CLASSES.keys())

t0 = time.time()
total = 0
for cls in classes:
    G.reset_scene()
    G.setup_render(res_x=160, res_y=160, samples=28, transparent=True)
    rig = G.build_character(cls, 0)
    G.sprite_stage(ortho_scale=rig['ortho'], target_z=0.62 * rig['s'] + 0.35)
    anims = ANIMS + ([('cast', 4)] if cls == 'mage' else [])
    os.makedirs('%s/%s' % (OUTD, cls), exist_ok=True)
    for dname, ddeg in DIRS:
        for aname, n in anims:
            for f in range(n):
                G.apply_pose(rig, G.get_pose(cls, aname, f), direction_deg=ddeg)
                G.render_to('%s/%s/%s_%s_%d.png' % (OUTD, cls, dname, aname, f))
                total += 1
    print('CLASSE %s OK (%d rendus, %.0fs)' % (cls, total, time.time() - t0))
print('SPRITES TERMINE %d rendus en %.0fs' % (total, time.time() - t0))
