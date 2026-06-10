# Test visuel : bretteur idle S frame 0 en 128 et 512
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gmlib as G

G.reset_scene()
G.setup_render(res_x=128, res_y=128, samples=24, transparent=True)
rig = G.build_character('bretteur', 0)
G.apply_pose(rig, G.get_pose('bretteur', 'idle', 0), direction_deg=0)
G.sprite_stage(ortho_scale=rig['ortho'], target_z=0.62 * rig['s'] + 0.35)

t0 = time.time()
G.render_to(G.OUT + "/test_bretteur_128.png")
t128 = time.time() - t0

sc = __import__('bpy').context.scene
sc.render.resolution_x = sc.render.resolution_y = 512
t0 = time.time()
G.render_to(G.OUT + "/test_bretteur_512.png")
print("TIMING 128=%.1fs 512=%.1fs" % (t128, time.time() - t0))
