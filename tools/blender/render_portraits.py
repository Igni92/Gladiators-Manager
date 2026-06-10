# Rendu des portraits (6 classes x 3 variantes, 512px, buste 3/4).
# /opt/blender/blender -b -P render_portraits.py
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gmlib as G
import bpy

DEST = G.ASSETS + '/portraits'
os.makedirs(DEST, exist_ok=True)

t0 = time.time()
for cls in G.CLASSES.keys():
    for v in range(3):
        G.reset_scene()
        G.setup_render(res_x=512, res_y=512, samples=32, transparent=True)
        rig = G.build_character(cls, v)
        G.apply_pose(rig, G.get_pose(cls, 'idle', 0), direction_deg=0)
        s = rig['s']
        neck_z = (0.64 + 0.04 + 0.62) * s
        G.portrait_stage(neck_world_z=neck_z, scale=s)
        G.render_to('%s/%s_%d.png' % (DEST, cls, v))
        print('PORTRAIT %s_%d OK (%.0fs)' % (cls, v, time.time() - t0))
print('PORTRAITS TERMINE en %.0fs' % (time.time() - t0))
