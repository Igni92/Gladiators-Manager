# Rendu des icônes 3D (128px, alpha) — /opt/blender/blender -b -P render_icons.py
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gmlib as G
import gmicons as I
import bpy
from math import radians

DEST = G.ASSETS + '/icons'
os.makedirs(DEST, exist_ok=True)

t0 = time.time()
for nom, builder in I.ICONES.items():
    G.reset_scene()
    G.setup_render(res_x=128, res_y=128, samples=24, transparent=True)
    m = I.M()
    builder(m)

    # caméra ortho de face légèrement plongeante
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.7
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.collection.objects.link(cam)
    import math
    elev = radians(22)
    d = 12
    cam.location = (0, -d * math.cos(elev), 0.65 + d * math.sin(elev))
    cam.rotation_euler = (radians(90) - elev, 0, 0)
    bpy.context.scene.camera = cam

    def sun(name, energy, color, rot, angle=0.25):
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.color = color
        ld.angle = angle
        lo = bpy.data.objects.new(name, ld)
        bpy.context.collection.objects.link(lo)
        lo.rotation_euler = [radians(a) for a in rot]

    sun('key', 3.0, (1.0, 0.95, 0.85), (52, 0, -30), 0.15)
    sun('fill', 1.0, (0.6, 0.7, 1.0), (60, 0, 40), 0.9)
    sun('rim', 3.2, (1.0, 0.55, 0.25), (-45, 0, 15), 0.4)

    G.render_to('%s/%s.png' % (DEST, nom))
    print('ICONE %s OK (%.0fs)' % (nom, time.time() - t0))
print('ICONES TERMINE en %.0fs' % (time.time() - t0))
