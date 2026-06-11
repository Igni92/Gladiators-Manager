# Test visuel v3 : rend des combos (race, genre, classe) en 512px, vue S idle.
# /opt/blender/blender -b -P test_v3.py -- humain:m:bretteur:1 elfe:f:mage:1 ...
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gmlib as G

OUTD = G.OUT + '/test_v3'
os.makedirs(OUTD, exist_ok=True)

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not args:
    args = ['humain:m:bretteur:1', 'elfe:f:mage:1', 'nain:m:colosse:2',
            'orc:m:berserker:2', 'gobelin:m:roublard:0', 'drakeide:f:lancier:1']

t0 = time.time()
for tok in args:
    race, genre, cls, corp = tok.split(':')
    G.reset_scene()
    G.setup_render(res_x=512, res_y=512, samples=24, transparent=True)
    rig = G.build_character(cls, race=race, genre=genre, corpulence=int(corp), variant=0)
    G.apply_pose(rig, G.get_pose(cls, 'idle', 0), direction_deg=0)
    G.sprite_stage(ortho_scale=rig['ortho'], target_z=rig['height'] * 0.52)
    name = '%s_%s_%s' % (race, genre, cls)
    G.render_to('%s/%s.png' % (OUTD, name))
    print('TEST %s OK (%.0fs)' % (name, time.time() - t0))
print('TESTS TERMINE en %.0fs' % (time.time() - t0))
