# Rendu des portraits v3 : race x genre x classe = 72 (512px, buste 3/4, reprise possible).
# /opt/blender/blender -b -P render_portraits_v3.py
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gmlib as G

DEST = G.ASSETS + '/portraits'
os.makedirs(DEST, exist_ok=True)


def corp_for(cls, race):
    if cls in ('colosse', 'berserker'):
        return 2
    if cls == 'roublard' or race == 'gobelin':
        return 0
    return 1


t0 = time.time()
n = 0
for race in G.RACE_LIST:
    for genre in ('m', 'f'):
        for cls in G.CLASSES.keys():
            dest = '%s/%s_%s_%s.png' % (DEST, race, genre, cls)
            if os.path.exists(dest):
                continue
            G.reset_scene()
            G.setup_render(res_x=512, res_y=512, samples=40, transparent=True)
            rig = G.build_character(cls, race=race, genre=genre, corpulence=corp_for(cls, race))
            G.apply_pose(rig, G.get_pose(cls, 'idle', 0), direction_deg=0)
            s = rig['s']
            G.portrait_stage(neck_world_z=(0.64 + 0.04 + 0.62) * s, scale=s)
            G.render_to(dest)
            n += 1
            print('PORTRAIT %s_%s_%s OK (%d, %.0fs)' % (race, genre, cls, n, time.time() - t0), flush=True)
print('PORTRAITS V3 TERMINE %d rendus en %.0fs' % (n, time.time() - t0))
