# -*- coding: utf-8 -*-
"""Rendu de la carte du monde.

Usage :
  /opt/blender/blender -b -P render_map.py -- preview [samples]
  /opt/blender/blender -b -P render_map.py -- layers <rx> <ry> <samples>
  /opt/blender/blender -b -P render_map.py -- full <rx> <ry> <samples>

preview : rendu complet 512x683 -> out/raw_preview.png + out/lieux_raw.json
layers  : 3 rendus (fond opaque, milieu alpha, premier alpha) -> out/raw_*.png
full    : rendu complet opaque à la résolution donnée -> out/raw_full.png
"""
import json
import math
import os
import sys
import time

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wmlib as W  # noqa: E402
from bpy_extras.object_utils import world_to_camera_view as w2cv  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['preview']
mode = argv[0]

CAM = dict(elev=55.0, dist=33.0, lens=35.0, target=(0.0, 0.6, 0.4))


def log(msg):
    print('[worldmap] %s' % msg, flush=True)


def walk(root):
    yield root
    for c in root.children_recursive:
        yield c


def set_layer(world, visible_groups, catchers_on):
    for gname, root in world['groups'].items():
        hide = gname not in visible_groups
        for o in walk(root):
            o.hide_render = hide
    for o in world['catchers']:
        if catchers_on:
            o.hide_render = False
            o.is_shadow_catcher = True
        else:
            o.is_shadow_catcher = False


def write_lieux(cam, path):
    sc = bpy.context.scene
    out = []
    for lid, (nom, p) in W.LIEUX.items():
        co = w2cv(sc, cam, Vector(p))
        out.append({'id': lid, 'nom': nom,
                    'x': round(co.x, 4), 'y': round(1.0 - co.y, 4)})
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    log('lieux -> %s' % path)


def render(path):
    t0 = time.time()
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    log('rendu %s (%.1fs)' % (os.path.basename(path), time.time() - t0))


t0 = time.time()
W.G.reset_scene()
log('construction du monde...')
world = W.build_world()
log('monde construit (%.1fs, %d objets)' % (time.time() - t0, len(bpy.data.objects)))

if mode == 'preview':
    samples = int(argv[1]) if len(argv) > 1 else 18
    sc = W.G.setup_render(512, 683, samples=samples, transparent=False)
    cam = W.map_stage(**CAM)
    set_layer(world, {'fond', 'milieu', 'premier'}, catchers_on=False)
    render(os.path.join(W.OUT, 'raw_preview.png'))
    write_lieux(cam, os.path.join(W.OUT, 'lieux_raw.json'))

elif mode == 'full':
    rx, ry = int(argv[1]), int(argv[2])
    samples = int(argv[3]) if len(argv) > 3 else 32
    sc = W.G.setup_render(rx, ry, samples=samples, transparent=False)
    cam = W.map_stage(**CAM)
    set_layer(world, {'fond', 'milieu', 'premier'}, catchers_on=False)
    render(os.path.join(W.OUT, 'raw_full.png'))
    write_lieux(cam, os.path.join(W.OUT, 'lieux_raw.json'))

elif mode == 'layers':
    rx, ry = int(argv[1]), int(argv[2])
    samples = int(argv[3]) if len(argv) > 3 else 32
    sc = W.G.setup_render(rx, ry, samples=samples, transparent=False)
    cam = W.map_stage(**CAM)
    write_lieux(cam, os.path.join(W.OUT, 'lieux_raw.json'))

    log('--- couche FOND (opaque) ---')
    sc.render.film_transparent = False
    sc.render.image_settings.color_mode = 'RGB'
    set_layer(world, {'fond'}, catchers_on=False)
    render(os.path.join(W.OUT, 'raw_fond.png'))

    log('--- couche MILIEU (alpha + ombres) ---')
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
    set_layer(world, {'milieu'}, catchers_on=True)
    render(os.path.join(W.OUT, 'raw_milieu.png'))

    log('--- couche PREMIER (alpha + ombres) ---')
    set_layer(world, {'premier'}, catchers_on=True)
    render(os.path.join(W.OUT, 'raw_premier.png'))

else:
    raise SystemExit('mode inconnu: %s' % mode)

log('terminé.')
