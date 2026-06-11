# -*- coding: utf-8 -*-
"""Rendu des props de la carte sur alpha (256-512 px, caméra ~50°, ombre au sol).

Usage :
  /opt/blender/blender -b -P render_props.py            # tous les props
  /opt/blender/blender -b -P render_props.py -- sapin navire   # sélection
"""
import math
import os
import sys
import time

import bpy
from math import radians
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wmlib as W  # noqa: E402
from bpy_extras.object_utils import world_to_camera_view as w2cv  # noqa: E402

G = W.G
PROPS_DIR = os.path.join(W.MONDE, 'props')

#         nom            builder                          taille px
SPECS = [
    ('sapin',        lambda: W.build_sapin(seed=0),        320),
    ('chene',        lambda: W.build_chene(seed=0),        320),
    ('rocher_a',     lambda: W.build_rocher_a(seed=3),     256),
    ('rocher_b',     lambda: W.build_rocher_b(seed=1),     256),
    ('montagne',     lambda: W.build_montagne(seed=1),     512),
    ('donjon',       lambda: W.build_donjon(),             512),
    ('tour_mage',    lambda: W.build_tour_mage(),          512),
    ('cristal',      lambda: W.build_cristal(seed=0),      320),
    ('pont',         lambda: W.build_pont(),               448),
    ('navire',       lambda: W.build_navire(),             512),
    ('colisee_mini', lambda: W.build_colisee(),            512),
]


def log(msg):
    print('[props] %s' % msg, flush=True)


def scene_bbox():
    bpy.context.view_layer.update()
    pts = []
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.is_shadow_catcher:
            continue
        for c in o.bound_box:
            pts.append(o.matrix_world @ Vector(c))
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def stage_prop(elev=50.0, az=-18.0, lens=46.0, margin=0.84):
    sc = bpy.context.scene
    lo, hi = scene_bbox()
    # inclure le sol (ombre) dans le cadrage
    lo.z = min(lo.z, 0.0) - 0.05 * (hi.z - lo.z)
    target = (lo + hi) / 2.0
    maxdim = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)

    cd = bpy.data.cameras.new('pcam')
    cd.lens = lens
    cd.clip_end = 200
    cam = bpy.data.objects.new('pcam', cd)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam

    e, a = radians(elev), radians(az)
    corners = [Vector((x, y, z))
               for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    D = 2.0 * maxdim
    for _ in range(14):
        cam.location = (target.x + D * math.cos(e) * math.sin(a),
                        target.y - D * math.cos(e) * math.cos(a),
                        target.z + D * math.sin(e))
        look = target - cam.location
        cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        dev = 0.0
        for c in corners:
            co = w2cv(sc, cam, c)
            dev = max(dev, abs(co.x - 0.5), abs(co.y - 0.5))
        if abs(dev - 0.5 * margin) < 0.01:
            break
        D *= max(dev / (0.5 * margin), 0.55)

    W.sun('key', 3.2, (1.0, 0.94, 0.82), (50, 0, -35), 0.10)
    W.sun('fill', 1.0, (0.60, 0.74, 1.0), (62, 0, 40), 0.9)
    W.sun('rim', 1.8, (1.0, 0.70, 0.40), (-46, 0, 18), 0.4)
    w = sc.world
    if w and w.use_nodes:
        bg = w.node_tree.nodes['Background']
        bg.inputs[0].default_value = (0.70, 0.78, 0.90, 1.0)
        bg.inputs[1].default_value = 0.5

    # disque récepteur d'ombre
    r = max(hi.x - lo.x, hi.y - lo.y) * 1.6 + 0.4
    bpy.ops.mesh.primitive_circle_add(vertices=40, radius=r, fill_type='NGON',
                                      location=((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 0))
    ground = bpy.context.active_object
    ground.name = 'catcher'
    ground.is_shadow_catcher = True
    return cam


only = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None
os.makedirs(PROPS_DIR, exist_ok=True)

for name, builder, size in SPECS:
    if only and name not in only:
        continue
    t0 = time.time()
    G.reset_scene()
    G.setup_render(size, size, samples=36, transparent=True)
    builder()
    stage_prop()
    path = os.path.join(PROPS_DIR, name + '.png')
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    log('%s -> %dpx (%.1fs)' % (name, size, time.time() - t0))

log('props terminés.')
