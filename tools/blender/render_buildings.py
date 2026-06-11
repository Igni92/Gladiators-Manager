# Rendu des batiments de la ville + decor.
# /opt/blender/blender -b -P render_buildings.py
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gmlib as G
import gmtown as T
import bpy

DEST = G.ASSETS + '/buildings'
os.makedirs(DEST, exist_ok=True)

JOBS = [
    ('arene', lambda M: T.build_arene(M), 768),
    ('marche', lambda M: T.build_marche(M), 512),
    ('caserne', lambda M: T.build_caserne(M), 512),
    ('taverne', lambda M: T.build_taverne(M), 512),
    ('banque', lambda M: T.build_banque(M), 512),
    ('infirmerie', lambda M: T.build_infirmerie(M), 512),
    ('fontaine', lambda M: T.build_fontaine(M), 256),
    ('arbre_a', lambda M: T.build_arbre(M, True), 256),
    ('arbre_b', lambda M: T.build_arbre(M, False), 256),
    ('statue', lambda M: T.build_statue(M), 256),
    ('puits', lambda M: T.build_puits(M), 256),
    ('caisses', lambda M: T.build_caisses(M), 256),
    ('charrette', lambda M: T.build_charrette(M), 256),
    ('lampe', lambda M: T.build_lampe(M), 256),
    ('buisson', lambda M: T.build_buisson(M), 256),
]

t0 = time.time()
for name, builder, res in JOBS:
    G.reset_scene()
    G.setup_render(res_x=res, res_y=res, samples=32, transparent=True)
    M = T.mats()
    root, ortho, tz = builder(M)
    root.rotation_euler = (0, 0, __import__('math').radians(-34))
    G.sprite_stage(ortho_scale=ortho, target_z=tz, elev=50.0)
    G.render_to('%s/%s.png' % (DEST, name))
    print('BATIMENT %s OK (%.0fs)' % (name, time.time() - t0))
print('BATIMENTS TERMINE en %.0fs' % (time.time() - t0))
