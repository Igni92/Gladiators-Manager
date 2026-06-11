# -*- coding: utf-8 -*-
"""wmlib — bibliothèque de la carte du monde « Pixar fantasy » (AGENT 2).

Diorama insulaire low-poly doux. Convention : X = est, Y = nord, Z = haut.
Caméra au sud inclinée ~55°. Importe gmlib/gmtown SANS les modifier.

Groupes de rendu (couches) :
  fond    : mer + terrain + îlots + chemins + vagues   -> carte_fond.png
  milieu  : montagnes, forêts, donjon, île magique...  -> carte_milieu.png (alpha)
  premier : ville du joueur, port, props proches       -> carte_premier.png (alpha)
"""
import math
import os
import random
import sys

import bpy
from math import radians
from mathutils import Vector, noise

BASE = '/home/user/Gladiators-Manager/tools/blender'
if BASE not in sys.path:
    sys.path.insert(0, BASE)
import gmlib as G    # noqa: E402
import gmtown as T   # noqa: E402

WM = os.path.join(BASE, 'worldmap')
OUT = os.path.join(WM, 'out')
MONDE = '/home/user/Gladiators-Manager/public/assets/monde'

# ---------------------------------------------------------------- palette ----
# Hex sRGB — source unique de vérité, documentée dans DOC.md.
PAL = {
    'mer_profonde':   '#36659B',
    'mer_moyenne':    '#4E9BBD',
    'mer_lagon':      '#74D2C5',
    'ecume':          '#F3F8F6',
    'sable':          '#EBD9A4',
    'herbe':          '#8CC063',
    'herbe2':         '#7CB456',
    'sous_bois':      '#5E9A4E',
    'roche':          '#998D80',
    'roche_sombre':   '#6E625A',
    'neige':          '#F2F6FA',
    'chemin':         '#DDBE85',
    'terre_brulee':   '#7C6C52',
    'pave':           '#CDC3AC',
    'tronc':          '#7A4F2A',
    'sapin':          '#3F7D4D',
    'sapin2':         '#4C8F4F',
    'chene':          '#6FB052',
    'chene2':         '#84C45E',
    'bois':           '#8A5A33',
    'bois_clair':     '#C28A4E',
    'pierre_ruine':   '#5E5663',
    'noir':           '#1A1714',
    'tour_mage':      '#4B4E9E',
    'toit_mage':      '#7C4FB5',
    'cristal_cyan':   '#7FE8FF',
    'cristal_violet': '#C18CFF',
    'coque':          '#8A5A33',
    'voile':          '#F2EDE0',
    'drapeau':        '#C8402E',
    'or':             '#F2A93B',
    'ile_magique':    '#79C7A8',
    'brume':          '#E9E6DC',
}


def lin(hexstr):
    """Hex sRGB -> tuple linéaire pour Cycles."""
    h = hexstr.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def wmat(key, rough=0.9, spec=0.2, metallic=0.0, emit=None, emit_strength=0.0):
    name = 'wm_' + key
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(PAL[key]), 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metallic
    try:
        b.inputs['Specular IOR Level'].default_value = spec
    except KeyError:
        pass
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(PAL[emit]), 1.0)
        b.inputs['Emission Strength'].default_value = emit_strength
    return m

# ------------------------------------------------------- primitives plates ----


def _set(o, parent, loc, rot, m, smooth=False):
    if parent is not None:
        o.parent = parent
    o.location = loc
    o.rotation_euler = [radians(a) for a in rot]
    if m is not None:
        o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = smooth
    return o


def fbox(name, parent, loc, scale, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    return _set(o, parent, loc, rot, m)


def fcyl(name, parent, loc, r, depth, m, rot=(0, 0, 0), verts=10, origin='center'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth)
    o = bpy.context.active_object
    o.name = name
    if origin == 'top':
        for v in o.data.vertices:
            v.co.z -= depth / 2.0
    elif origin == 'bottom':
        for v in o.data.vertices:
            v.co.z += depth / 2.0
    return _set(o, parent, loc, rot, m)


def fcone(name, parent, loc, r1, r2, depth, m, rot=(0, 0, 0), verts=10):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth)
    o = bpy.context.active_object
    o.name = name
    return _set(o, parent, loc, rot, m)


def fsphere(name, parent, loc, scale, m, rot=(0, 0, 0), seg=10, rings=7, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1.0)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    return _set(o, parent, loc, rot, m, smooth=smooth)


def ficos(name, parent, loc, scale, m, rot=(0, 0, 0), subdiv=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1.0)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    return _set(o, parent, loc, rot, m)


def ftorus(name, parent, loc, R, r, m, rot=(0, 0, 0), scale=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r,
                                     major_segments=14, minor_segments=6)
    o = bpy.context.active_object
    o.name = name
    if scale:
        o.scale = scale
    return _set(o, parent, loc, rot, m)

# ----------------------------------------------------------------- maths ----


def clamp(x, a, b):
    return a if x < a else (b if x > b else x)


def smoothstep(a, b, x):
    """0 en a -> 1 en b (a > b accepté)."""
    t = clamp((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def fbm(x, y, seed=0.0):
    v = 0.0
    amp = 1.0
    f = 1.0
    for _ in range(3):
        v += amp * noise.noise(Vector((x * f, y * f, seed + 3.17 * f)))
        amp *= 0.5
        f *= 2.1
    return v / 1.75


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    L2 = vx * vx + vy * vy
    t = clamp((wx * vx + wy * vy) / L2, 0.0, 1.0) if L2 > 1e-9 else 0.0
    dx, dy = px - (ax + t * vx), py - (ay + t * vy)
    return math.hypot(dx, dy)


def polyline_dist(x, y, pts):
    return min(seg_dist(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])
               for i in range(len(pts) - 1))


def clone(src_root, name, parent=None):
    """Copie récursive d'une hiérarchie, mailles partagées (instances)."""
    nr = bpy.data.objects.new(name, None)
    nr.empty_display_size = 0.05
    bpy.context.collection.objects.link(nr)
    if parent is not None:
        nr.parent = parent

    def rec(src, par):
        for ch in src.children:
            c = ch.copy()
            bpy.context.collection.objects.link(c)
            c.parent = par
            rec(ch, c)
    rec(src_root, nr)
    return nr


def place(root, loc, rot_z=0.0, scale=1.0):
    root.location = loc
    root.rotation_euler = (0, 0, radians(rot_z))
    if isinstance(scale, (int, float)):
        root.scale = (scale, scale, scale)
    else:
        root.scale = scale
    return root

# ------------------------------------------------------------- géographie ----

ISLE_RX, ISLE_RY = 9.5, 10.8
CITY = (0.0, -4.4)        # ville du joueur (centre-sud)
FORET = (-5.6, 0.5)       # forêt ouest
CLEAR = (-5.0, 0.2)       # clairière (ligue bronze)
DONJ = (6.1, 0.8)         # donjon est (ligue argent)
COL = (0.4, 6.4)          # col des montagnes nord (ligue or)
PORT = (1.4, -9.4)        # port sud
FLOTTANTE = (6.3, 8.2, 2.7)   # île flottante nord-est (coupe)
COLISLE = (-6.0, 13.8)    # île-colisée au large (tournoi international)

RIVER = [(2.6, 5.2), (3.0, 3.0), (3.8, 0.8), (4.3, -1.6),
         (4.8, -4.2), (5.6, -6.6), (6.6, -9.2)]
PONT_POS = (4.28, -1.05)

PATHS = {
    'port':   [(0.0, -7.0), (0.7, -7.9), PORT, (1.7, -10.0)],
    'foret':  [(-2.2, -5.6), (-3.4, -3.6), (-4.4, -1.6), CLEAR],
    'col':    [(0.4, -1.8), (0.6, 1.2), (0.4, 3.8), (0.4, 5.4), COL, (0.4, 7.4)],
    'donjon': [(2.5, -3.4), (3.5, -2.0), (4.28, -1.05), (5.1, -0.1), DONJ],
}

# Lieux du jeu : id -> (nom, point monde). Projetés en (x,y) normalisés par la caméra.
LIEUX = {
    'ville':                 ('Votre cité', (CITY[0], CITY[1], 0.6)),
    'ligue_bronze':          ('Ligue de Bronze', (CLEAR[0], CLEAR[1], 0.7)),
    'ligue_argent':          ("Ligue d'Argent", (DONJ[0], DONJ[1], 1.0)),
    'ligue_or':              ("Ligue d'Or", (COL[0], COL[1], 1.6)),
    'coupe':                 ('Coupe du Royaume', (FLOTTANTE[0], FLOTTANTE[1], FLOTTANTE[2] + 1.0)),
    'tournoi_international': ('Tournoi des Champions', (COLISLE[0], COLISLE[1], 0.9)),
}


def edge_factor(x, y):
    nx, ny = x / ISLE_RX, y / ISLE_RY
    d = math.hypot(nx, ny)
    if d > 1e-6:
        a = math.atan2(ny, nx)
        d += 0.06 * noise.noise(Vector((math.cos(a) * 1.9, math.sin(a) * 1.9, 4.7)))
    return smoothstep(1.02, 0.80, d)


def _flatten(h, x, y, c, r, blend, target):
    d = math.hypot(x - c[0], y - c[1])
    t = smoothstep(r, r + blend, d)   # 0 dedans -> 1 dehors
    return lerp(target, h, t)


def height(x, y):
    """Champ de hauteur de l'île principale."""
    e = edge_factor(x, y)
    if e <= 0.0:
        return -0.9
    n = fbm(x * 0.10, y * 0.10, seed=5.0)
    h = e * (0.42 + 0.85 * max(n, -0.25))
    h += e * 1.05 * smoothstep(3.5, 7.2, y)          # plateau nord
    h = _flatten(h, x, y, CITY, 3.0, 0.9, 0.30)      # place de la ville
    h = _flatten(h, x, y, CLEAR, 1.6, 0.8, 0.42)     # clairière
    h = _flatten(h, x, y, DONJ, 2.0, 0.9, 0.50)      # site du donjon
    h = _flatten(h, x, y, COL, 1.3, 0.9, 1.30)       # col
    h = _flatten(h, x, y, PORT, 1.6, 0.8, 0.18)      # esplanade du port
    dr = polyline_dist(x, y, RIVER)
    if dr < 1.0:
        h = min(h, lerp(-0.42, h, smoothstep(0.30, 1.0, dr)))
    return h


def face_biome(x, y, h):
    """Index de matériau du terrain par face. Slots :
    0 sable 1 herbe 2 herbe2 3 sous-bois 4 roche 5 neige 6 terre brûlée 7 pavé."""
    w = noise.noise(Vector((x * 0.45, y * 0.45, 9.2)))
    if h < 0.13 + 0.05 * w:
        return 0
    if math.hypot(x - CITY[0], y - CITY[1]) < 2.75:
        return 7
    if math.hypot(x - PORT[0], y - PORT[1]) < 1.3 + 0.3 * w:
        return 0
    if math.hypot(x - DONJ[0], y - DONJ[1]) < 2.0 + 0.5 * w:
        return 6
    if h > 1.95 + 0.25 * w:
        return 5
    if h > 1.45 + 0.25 * w:
        return 4
    if math.hypot(x - CLEAR[0], y - CLEAR[1]) < 1.45:
        return 1
    if math.hypot(x - FORET[0], y - FORET[1]) < 4.4 + 0.7 * w:
        return 3
    return 1 if w > -0.15 else 2

# ----------------------------------------------------------------- fond ----


def build_terrain(parent):
    nx, ny = 110, 126
    x0, x1, y0, y1 = -11.5, 11.5, -13.0, 13.0
    verts = []
    for j in range(ny + 1):
        y = y0 + (y1 - y0) * j / ny
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            verts.append((x, y, height(x, y)))
    faces = []
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    me = bpy.data.meshes.new('terrain')
    me.from_pydata(verts, [], faces)
    ob = bpy.data.objects.new('terrain', me)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    for key in ('sable', 'herbe', 'herbe2', 'sous_bois', 'roche',
                'neige', 'terre_brulee', 'pave'):
        me.materials.append(wmat(key))
    for p in me.polygons:
        c = p.center
        p.material_index = face_biome(c.x, c.y, c.z)
        p.use_smooth = False
    return ob


def sea_material():
    m = bpy.data.materials.get('wm_mer')
    if m:
        return m
    m = bpy.data.materials.new('wm_mer')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.18
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0 / (ISLE_RX + 1.0), 1.0 / (ISLE_RY + 1.0), 1.0)
    ln = nt.nodes.new('ShaderNodeVectorMath')
    ln.operation = 'LENGTH'
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.92
    mr.inputs['From Max'].default_value = 2.6
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (*lin(PAL['mer_lagon']), 1.0)
    e = cr.elements.new(0.30)
    e.color = (*lin(PAL['mer_moyenne']), 1.0)
    cr.elements[-1].position = 0.85
    cr.elements[-1].color = (*lin(PAL['mer_profonde']), 1.0)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], ln.inputs[0])
    nt.links.new(ln.outputs['Value'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    # vaguelettes en bump léger
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 0.6
    nz.inputs['Detail'].default_value = 3.0
    bmp = nt.nodes.new('ShaderNodeBump')
    bmp.inputs['Strength'].default_value = 0.06
    nt.links.new(nz.outputs['Fac'], bmp.inputs['Height'])
    nt.links.new(bmp.outputs['Normal'], b.inputs['Normal'])
    return m


def build_sea(parent):
    # centrée sur l'île (0,0) : les coordonnées Object pilotent le dégradé radial
    bpy.ops.mesh.primitive_plane_add(size=160.0)
    o = bpy.context.active_object
    o.name = 'mer'
    o.parent = parent
    o.location = (0, 0, 0)
    o.data.materials.append(sea_material())
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def build_waves(parent, rnd):
    m = wmat('ecume', rough=0.8)
    proto = None
    for k in range(26):
        for _ in range(40):
            x = rnd.uniform(-11.5, 11.5)
            y = rnd.uniform(-13.5, 17.5)
            if edge_factor(x, y) > 0.02:
                continue
            if math.hypot(x - COLISLE[0], y - COLISLE[1]) < 3.6:
                continue
            break
        else:
            continue
        if proto is None:
            proto = ftorus('vague0', parent, (x, y, 0.02), 0.34, 0.045, m)
            proto.rotation_euler = (0, 0, radians(rnd.uniform(0, 180)))
            proto.scale = (1.0, 0.55, 0.30)
        else:
            o = proto.copy()
            bpy.context.collection.objects.link(o)
            o.parent = parent
            o.location = (x, y, 0.02)
            o.rotation_euler = (0, 0, radians(rnd.uniform(0, 180)))
            s = rnd.uniform(0.7, 1.4)
            o.scale = (s, 0.55 * s, 0.30)
    return


def build_paths(parent):
    m = wmat('chemin')
    proto = None
    n = 0
    for pname, pts in PATHS.items():
        for i in range(len(pts) - 1):
            ax, ay = pts[i]
            bx, by = pts[i + 1]
            L = math.hypot(bx - ax, by - ay)
            steps = max(1, int(L / 0.52))
            for k in range(steps + (1 if i == len(pts) - 2 else 0)):
                t = k / max(steps, 1)
                x, y = lerp(ax, bx, t), lerp(ay, by, t)
                if math.hypot(x - PONT_POS[0], y - PONT_POS[1]) < 1.0:
                    continue
                h = height(x, y)
                if h < 0.06:
                    continue
                if proto is None:
                    proto = fcyl('chemin0', parent, (x, y, h + 0.03), 0.14, 0.05, m, verts=7)
                else:
                    o = proto.copy()
                    bpy.context.collection.objects.link(o)
                    o.parent = parent
                    o.location = (x, y, h + 0.03)
                    s = 0.85 + 0.3 * ((n * 7) % 5) / 4.0
                    o.scale = (s, s, 1.0)
                n += 1


def build_islet_base(parent):
    """Terre de l'île-colisée (groupe fond). Renvoie la liste des mailles (catchers)."""
    base = G.empty('ilot_base', parent, (COLISLE[0], COLISLE[1], -0.25))
    objs = [
        fcone('roc', base, (0, 0, 0.42), 2.45, 1.7, 1.05, wmat('roche'), verts=12),
        fcyl('top', base, (0, 0, 0.97), 1.75, 0.10, wmat('herbe'), verts=12),
        fcyl('plage', base, (0, 0, 0.27), 2.75, 0.10, wmat('sable'), verts=14),
        fcyl('lagon', base, (0, 0, 0.262), 3.9, 0.02, wmat('mer_lagon', rough=0.35), verts=16),
    ]
    return base, objs

# --------------------------------------------------------------- props ------


def build_sapin(parent=None, seed=0):
    rnd = random.Random(100 + seed)
    root = G.empty('sapin_s%d' % seed, parent)
    m_tr = wmat('tronc')
    fcyl('tronc', root, (0, 0, 0.20), 0.085, 0.45, m_tr, verts=7)
    z, r = 0.38, 0.48
    for k in range(3):
        h = 0.66 - 0.11 * k
        fcone('feuille%d' % k, root, (0, 0, z + h * 0.45), r, 0.02, h,
              wmat('sapin' if k % 2 == 0 else 'sapin2'), verts=8,
              rot=(0, 0, rnd.uniform(0, 60)))
        z += h * 0.52
        r *= 0.70
    return root


def build_chene(parent=None, seed=0):
    rnd = random.Random(200 + seed)
    root = G.empty('chene_s%d' % seed, parent)
    fcyl('tronc', root, (0, 0, 0.28), 0.10, 0.60, wmat('tronc'), verts=7,
         rot=(0, rnd.uniform(-7, 7), 0))
    blobs = [((0, 0, 0.82), (0.48, 0.45, 0.38), 'chene'),
             ((0.30, 0.13, 0.64), (0.30, 0.28, 0.24), 'chene2'),
             ((-0.27, -0.09, 0.68), (0.28, 0.26, 0.22), 'chene'),
             ((0.02, -0.25, 0.95), (0.24, 0.22, 0.20), 'chene2')]
    for i, (loc, sc, key) in enumerate(blobs):
        ficos('feuille%d' % i, root, loc, sc, wmat(key),
              rot=(rnd.uniform(0, 40), rnd.uniform(0, 40), rnd.uniform(0, 90)))
    return root


def build_rocher_a(parent=None, seed=0):
    rnd = random.Random(300 + seed)
    root = G.empty('rocherA_s%d' % seed, parent)
    ficos('roc', root, (0, 0, 0.26), (0.42, 0.34, 0.30), wmat('roche'),
          rot=(rnd.uniform(-15, 15), rnd.uniform(-15, 15), rnd.uniform(0, 90)))
    return root


def build_rocher_b(parent=None, seed=0):
    rnd = random.Random(400 + seed)
    root = G.empty('rocherB_s%d' % seed, parent)
    ficos('roc1', root, (0.0, 0.0, 0.30), (0.40, 0.36, 0.34), wmat('roche'),
          rot=(0, 0, rnd.uniform(0, 90)))
    ficos('roc2', root, (0.38, -0.12, 0.16), (0.22, 0.20, 0.18), wmat('roche_sombre'),
          rot=(0, 0, rnd.uniform(0, 90)))
    ficos('roc3', root, (-0.30, 0.16, 0.13), (0.17, 0.15, 0.14), wmat('roche'),
          rot=(0, 0, rnd.uniform(0, 90)))
    return root


def build_montagne(parent=None, seed=0):
    rnd = random.Random(500 + seed)
    root = G.empty('mont_s%d' % seed, parent)
    rz = rnd.uniform(0, 36)
    o = fcone('roc', root, (0, 0, 1.0), 1.0, 0.03, 2.0, wmat('roche'), verts=9,
              rot=(0, 0, rz))
    for v in o.data.vertices:
        f = (1.0 - (v.co.z + 1.0) / 2.0)
        if f <= 0.02:
            continue
        v.co.x += 0.16 * f * noise.noise(Vector((v.co.x * 1.3 + seed, v.co.y * 1.3, 2.2)))
        v.co.y += 0.16 * f * noise.noise(Vector((v.co.x * 1.3, v.co.y * 1.3 + seed, 7.9)))
    fcone('neige', root, (0, 0, 1.58), 0.46, 0.02, 0.86, wmat('neige'), verts=9,
          rot=(0, 0, rz + 14))
    return root


def build_donjon(parent=None):
    root = G.empty('donjon_root', parent)
    m_p = wmat('pierre_ruine')
    m_s = wmat('roche_sombre')
    m_n = wmat('noir')
    # grande tour brisée
    fcyl('tour1', root, (-0.35, 0.18, 0.72), 0.55, 1.45, m_p, verts=10)
    rnd = random.Random(42)
    for k in range(10):
        if k in (2, 3, 7):     # brèches
            continue
        a = k / 10.0 * 2 * math.pi
        hk = 0.16 + 0.10 * ((k * 5) % 3) / 2.0
        fbox('cren%d' % k, root,
             (-0.35 + 0.50 * math.cos(a), 0.18 + 0.50 * math.sin(a), 1.46 + hk / 2),
             (0.18, 0.14, hk), m_p, rot=(0, 0, math.degrees(a)))
    # tour 2, cassée et penchée
    fcyl('tour2', root, (0.85, -0.30, 0.40), 0.36, 0.85, m_s, verts=9, rot=(4, 8, 0))
    fbox('t2cass', root, (0.78, -0.34, 0.86), (0.5, 0.4, 0.16), m_s, rot=(6, 10, 22))
    # murs ruinés
    fbox('mur1', root, (0.30, 0.52, 0.26), (1.25, 0.20, 0.52), m_s, rot=(0, 0, 12))
    fbox('mur2', root, (0.05, -0.62, 0.18), (0.8, 0.18, 0.36), m_p, rot=(0, 0, -8))
    # entrée sombre
    fbox('portail', root, (-0.35, -0.42, 0.34), (0.55, 0.16, 0.66), m_p)
    fcyl('arche', root, (-0.35, -0.42, 0.66), 0.27, 0.18, m_p, rot=(90, 0, 0), verts=12)
    fcyl('trou', root, (-0.35, -0.512, 0.30), 0.17, 0.02, m_n, rot=(90, 0, 0), verts=10)
    fbox('trou2', root, (-0.35, -0.512, 0.16), (0.34, 0.02, 0.30), m_n)
    # décombres
    for i, (x, y, s) in enumerate([(0.45, -0.75, 0.16), (-0.85, -0.5, 0.13),
                                   (1.15, 0.3, 0.14), (-0.1, 0.9, 0.11), (0.8, 0.75, 0.10)]):
        ficos('deb%d' % i, root, (x, y, s * 0.6), (s, s * 0.85, s * 0.7),
              m_s if i % 2 else m_p, rot=(0, 0, i * 37))
    # bannières déchirées (identité « ligue d'argent »)
    m_dr = wmat('drapeau')
    for i, (x, y) in enumerate([(-0.85, -0.85), (0.25, -1.0)]):
        fcyl('ban_p%d' % i, root, (x, y, 0.45), 0.025, 0.9, m_dr if False else wmat('bois'), verts=6)
        fbox('ban_c%d' % i, root, (x + 0.10, y, 0.74), (0.20, 0.02, 0.22), m_dr,
             rot=(0, 0, 8 * (1 - i)))
    return root


def build_tour_mage(parent=None):
    root = G.empty('tourmage_root', parent)
    m_t = wmat('tour_mage', rough=0.6)
    m_r = wmat('toit_mage', rough=0.5)
    fcone('corps', root, (0, 0, 1.0), 0.50, 0.34, 2.0, m_t, verts=10)
    fcyl('balcon', root, (0, 0, 2.04), 0.46, 0.13, wmat('pave'), verts=10)
    fcone('toit', root, (0, 0, 2.60), 0.52, 0.02, 0.95, m_r, verts=10)
    fsphere('pointe', root, (0, 0, 3.12), (0.09, 0.09, 0.09), wmat('or', rough=0.35, metallic=0.9), seg=10, rings=7)
    m_win = G.mat('lanterne', (1.0, 0.75, 0.3), emit=(1.0, 0.7, 0.25), emit_strength=6.0)
    for i, (a, z) in enumerate([(15, 0.8), (140, 1.25), (255, 1.7)]):
        r = 0.50 - 0.07 * (z / 2.0) * 2
        fbox('fen%d' % i, root,
             (r * math.cos(radians(a)), r * math.sin(radians(a)), z),
             (0.10, 0.10, 0.16), m_win, rot=(0, 0, a))
    m_c = wmat('cristal_cyan', rough=0.3, emit='cristal_cyan', emit_strength=2.2)
    ficos('cr1', root, (0.55, 0.25, 2.35), (0.07, 0.07, 0.13), m_c, rot=(12, 8, 0))
    ficos('cr2', root, (-0.50, -0.30, 2.05), (0.06, 0.06, 0.11), m_c, rot=(-10, 14, 30))
    return root


def build_cristal(parent=None, seed=0):
    rnd = random.Random(600 + seed)
    root = G.empty('cristal_s%d' % seed, parent)
    m_c = wmat('cristal_cyan', rough=0.3, emit='cristal_cyan', emit_strength=2.4)
    m_v = wmat('cristal_violet', rough=0.3, emit='cristal_violet', emit_strength=2.0)
    shards = [((0, 0, 0.52), (0.20, 0.20, 0.60), 6, m_c),
              ((0.26, 0.10, 0.30), (0.12, 0.12, 0.36), 24, m_v),
              ((-0.22, 0.14, 0.26), (0.10, 0.10, 0.30), -20, m_c),
              ((0.04, -0.26, 0.22), (0.09, 0.09, 0.26), 16, m_v)]
    for i, (loc, sc, tilt, mm) in enumerate(shards):
        ficos('sh%d' % i, root, loc, sc, mm,
              rot=(tilt, rnd.uniform(-10, 10), rnd.uniform(0, 90)))
    ficos('roc1', root, (0.3, -0.18, 0.08), (0.16, 0.13, 0.10), wmat('roche_sombre'))
    ficos('roc2', root, (-0.3, -0.05, 0.07), (0.13, 0.11, 0.09), wmat('roche'))
    return root


def build_pont(parent=None):
    root = G.empty('pont_root', parent)
    m_b = wmat('bois_clair')
    m_f = wmat('bois')
    R = 1.45
    n = 9
    for k in range(n):
        th = radians(-46 + 92 * k / (n - 1))
        y = R * math.sin(th)
        z = R * math.cos(th) - R * 0.72
        fbox('planche%d' % k, root, (0, y, z + 0.10), (0.62, 0.20, 0.055), m_b,
             rot=(-math.degrees(th), 0, 0))
    for sx in (-0.30, 0.30):
        for k in range(3):
            th = radians(-32 + 32 * k)
            y = R * math.sin(th)
            z = R * math.cos(th) - R * 0.72
            fbox('rampe%s%d' % (sx, k), root, (sx, y, z + 0.34), (0.05, 0.46, 0.05), m_f,
                 rot=(-math.degrees(th), 0, 0))
        for ky, yy in ((0, -0.95), (1, 0.95)):
            fcyl('pot%s%d' % (sx, ky), root, (sx, yy, 0.22), 0.045, 0.42, m_f, verts=6)
            fsphere('pom%s%d' % (sx, ky), root, (sx, yy, 0.45), (0.06, 0.06, 0.06), m_b, seg=8, rings=6)
    fbox('pied1', root, (0, -1.05, 0.05), (0.72, 0.35, 0.16), wmat('roche'))
    fbox('pied2', root, (0, 1.05, 0.05), (0.72, 0.35, 0.16), wmat('roche'))
    return root


def build_navire(parent=None):
    root = G.empty('navire_root', parent)
    m_c = wmat('coque')
    m_b = wmat('bois_clair')
    m_v = wmat('voile', rough=0.85)
    m_d = wmat('drapeau')
    fsphere('coque', root, (0, 0, 0.30), (0.42, 1.05, 0.34), m_c, seg=12, rings=8, smooth=False)
    fsphere('pont', root, (0, 0, 0.47), (0.34, 0.92, 0.10), m_b, seg=12, rings=6, smooth=False)
    fbox('chateau', root, (0, -0.72, 0.62), (0.46, 0.36, 0.26), m_c)
    fbox('chateau2', root, (0, -0.78, 0.80), (0.36, 0.26, 0.12), m_b)
    fcone('proue', root, (0, 1.06, 0.42), 0.16, 0.01, 0.5, m_c, rot=(-90, 0, 0), verts=8)
    fsphere('figure', root, (0, 1.28, 0.46), (0.07, 0.07, 0.07), wmat('or', rough=0.35, metallic=0.9), seg=8, rings=6)
    fcyl('mat', root, (0, 0.12, 1.05), 0.05, 1.30, wmat('bois'), verts=7)
    fcyl('vergue', root, (0, 0.12, 1.52), 0.032, 0.95, wmat('bois'), rot=(0, 90, 0), verts=6)
    fbox('voile', root, (0, 0.12, 1.12), (0.80, 0.05, 0.66), m_v, rot=(0, 0, 0))
    fbox('voile2', root, (0, 0.78, 0.92), (0.02, 0.42, 0.36), m_v, rot=(28, 0, 0))
    fbox('drapeau', root, (0.12, 0.12, 1.76), (0.22, 0.02, 0.10), m_d)
    return root


def build_colisee(parent=None):
    MT = T.mats()
    r, _, _ = T.build_arene(MT)
    if parent is not None:
        r.parent = parent
    return r


def build_maison(parent=None, seed=0):
    MT = T.mats()
    root = G.empty('maison_s%d' % seed, parent)
    fbox('corps', root, (0, 0, 0.40), (1.0, 0.85, 0.80), MT['platre'])
    T.gable_roof('toit', root, (0, 0, 0.92), 1.15, 1.0, 0.42,
                 MT['tuile'] if seed % 2 == 0 else MT['tuile_bleue'], MT['bois'])
    fbox('porte', root, (0, -0.45, 0.25), (0.28, 0.05, 0.50), MT['bois'])
    fbox('fen', root, (0.28, -0.45, 0.55), (0.18, 0.04, 0.20), MT['lanterne'])
    return root

# --------------------------------------------------------------- biomes -----


def build_montagnes(parent):
    peaks = [(-1.7, 7.7, 0, 3.9), (2.3, 7.4, 1, 3.5), (-3.6, 6.9, 2, 2.7),
             (4.2, 6.6, 3, 2.3), (0.4, 9.2, 4, 3.1), (-5.3, 5.6, 5, 1.9),
             (-0.9, 8.6, 6, 2.5), (3.2, 8.4, 7, 2.2)]
    protos = {}
    for x, y, seed, s in peaks:
        pk = seed % 3
        if pk not in protos:
            protos[pk] = build_montagne(parent, seed=pk)
            r = protos[pk]
        else:
            r = clone(protos[pk], 'mont_c%d' % seed, parent)
        h = height(x, y)
        place(r, (x, y, max(h, 0.4) - 0.22 * s), rot_z=seed * 47.0, scale=s)


def build_col(parent):
    """Marqueur du col (ligue d'or) : pilonnes + bannières rouges + cercle de pierres."""
    z = height(*COL)
    root = G.empty('col_root', parent, (COL[0], COL[1], z))
    m_p = wmat('roche_sombre')
    m_d = wmat('drapeau')
    for i, sx in enumerate((-0.55, 0.55)):
        fbox('pil%d' % i, root, (sx, 0, 0.45), (0.22, 0.22, 0.9), m_p)
        fbox('chap%d' % i, root, (sx, 0, 0.95), (0.30, 0.30, 0.12), wmat('roche'))
        fcyl('mat%d' % i, root, (sx, 0, 1.35), 0.03, 0.7, wmat('bois'), verts=6)
        fbox('ban%d' % i, root, (sx + 0.13, 0, 1.52), (0.24, 0.025, 0.14), m_d)
    for k in range(7):
        a = k / 7.0 * 2 * math.pi
        ficos('st%d' % k, root, (1.05 * math.cos(a), 0.85 * math.sin(a), 0.10),
              (0.13, 0.11, 0.14), wmat('roche'), rot=(0, 0, k * 31))
    return root


def build_foret(parent, rnd):
    protos = [build_sapin(parent, seed=i) for i in range(3)] + \
             [build_chene(parent, seed=i) for i in range(2)]
    # placer les protos eux-mêmes dans la forêt
    grid = set()
    placed = 0
    attempts = 0
    idx = 0
    while placed < 92 and attempts < 4000:
        attempts += 1
        x = FORET[0] + rnd.uniform(-4.6, 4.6)
        y = FORET[1] + rnd.uniform(-4.4, 4.4)
        if math.hypot((x - FORET[0]) / 4.7, (y - FORET[1]) / 4.5) > 1.0:
            continue
        if edge_factor(x, y) < 0.5:
            continue
        h = height(x, y)
        if h < 0.18 or h > 1.5:
            continue
        if math.hypot(x - CLEAR[0], y - CLEAR[1]) < 1.55:
            continue
        if polyline_dist(x, y, PATHS['foret']) < 0.45:
            continue
        key = (int(x / 0.6), int(y / 0.6))
        if key in grid:
            continue
        grid.add(key)
        sap = rnd.random() < 0.62
        proto = protos[idx % 3] if sap else protos[3 + idx % 2]
        if placed < len(protos):
            r = protos[placed]
        else:
            r = clone(proto, 'arbre_f%d' % placed, parent)
        s = rnd.uniform(0.8, 1.45)
        place(r, (x, y, h - 0.04), rot_z=rnd.uniform(0, 360), scale=s)
        idx += 1
        placed += 1
    return protos


def build_clairiere(parent):
    """Arène champêtre de la ligue de bronze dans la clairière."""
    z = height(*CLEAR)
    root = G.empty('clairiere_root', parent, (CLEAR[0], CLEAR[1], z))
    fcyl('sol', root, (0, 0, 0.025), 0.95, 0.05, wmat('sable'), verts=14)
    m_b = wmat('bois_clair')
    for k in range(10):
        a = k / 10.0 * 2 * math.pi
        fcyl('post%d' % k, root, (1.0 * math.cos(a), 0.92 * math.sin(a), 0.16),
             0.055, 0.32, m_b, verts=6)
    m_d = wmat('drapeau')
    for i, a_deg in enumerate((40, 220)):
        a = radians(a_deg)
        fcyl('mat%d' % i, root, (1.05 * math.cos(a), 0.95 * math.sin(a), 0.55),
             0.03, 1.1, wmat('bois'), verts=6)
        fbox('ban%d' % i, root, (1.05 * math.cos(a) + 0.12, 0.95 * math.sin(a), 0.92),
             (0.22, 0.02, 0.13), m_d)
    return root


def build_site_donjon(parent, rnd):
    z = height(*DONJ)
    d = build_donjon(parent)
    place(d, (DONJ[0], DONJ[1], z - 0.02), rot_z=-18, scale=1.5)
    # arbres morts + rochers
    m_t = wmat('roche_sombre')
    for i, (dx, dy) in enumerate([(-1.9, -0.6), (1.8, -1.3), (0.6, 1.9)]):
        x, y = DONJ[0] + dx, DONJ[1] + dy
        h = height(x, y)
        r = G.empty('mort%d' % i, parent, (x, y, h))
        fcyl('tronc', r, (0, 0, 0.35), 0.06, 0.75, m_t, verts=6, rot=(0, rnd.uniform(-8, 8), 0))
        fcyl('br1', r, (0.12, 0, 0.62), 0.03, 0.4, m_t, verts=5, rot=(0, 48, 0))
        fcyl('br2', r, (-0.10, 0.04, 0.50), 0.025, 0.32, m_t, verts=5, rot=(0, -55, 20))
    for i in range(5):
        x = DONJ[0] + rnd.uniform(-2.4, 2.4)
        y = DONJ[1] + rnd.uniform(-2.2, 2.2)
        h = height(x, y)
        if h < 0.15:
            continue
        r = build_rocher_a(parent, seed=20 + i) if i % 2 else build_rocher_b(parent, seed=20 + i)
        place(r, (x, y, h - 0.03), rot_z=rnd.uniform(0, 360), scale=rnd.uniform(0.5, 0.9))


def build_ile_magique(parent):
    root = G.empty('ilemagique_root', parent, FLOTTANTE)
    m_rock = wmat('roche_sombre')
    m_g = wmat('ile_magique')
    fcone('roc', root, (0, 0, -0.62), 0.14, 1.30, 1.25, m_rock, verts=10)
    fcyl('herbe', root, (0, 0, 0.06), 1.30, 0.15, m_g, verts=12)
    t = build_tour_mage(root)
    place(t, (-0.18, 0.10, 0.13), rot_z=20, scale=0.85)
    c1 = build_cristal(root, seed=1)
    place(c1, (0.72, -0.42, 0.13), rot_z=30, scale=0.9)
    c2 = build_cristal(root, seed=2)
    place(c2, (-0.80, -0.30, 0.13), rot_z=160, scale=0.7)
    # rochers flottants satellites
    for i, (x, y, z, s) in enumerate([(1.9, 0.5, -0.7, 0.30), (-1.8, -0.2, -1.1, 0.22),
                                      (1.3, -1.2, -1.5, 0.18), (-1.2, 1.1, -0.5, 0.16)]):
        ficos('sat%d' % i, root, (x, y, z), (s, s * 0.9, s * 0.75), m_rock, rot=(0, 0, i * 61))
        if i < 2:
            fcyl('sat_h%d' % i, root, (x, y, z + s * 0.7), s * 0.95, 0.08, m_g, verts=9)
    # étincelles émissives
    m_e = wmat('cristal_cyan', rough=0.3, emit='cristal_cyan', emit_strength=2.4)
    for i, (x, y, z) in enumerate([(0.9, 0.8, 0.9), (-1.1, 0.4, 1.3), (0.2, -1.2, 0.7)]):
        ficos('etin%d' % i, root, (x, y, z), (0.05, 0.05, 0.05), m_e)
    return root


def build_ile_colisee(parent):
    """Le colisée et son décor, posés sur l'îlot (la terre de l'îlot est dans le fond)."""
    zTop = -0.25 + 1.02   # base îlot + plateau
    root = G.empty('colisee_site', parent, (COLISLE[0], COLISLE[1], zTop))
    col = build_colisee(root)
    place(col, (0, 0, 0.02), rot_z=10, scale=0.50)
    MT = T.mats()
    for i, (x, y) in enumerate([(-1.35, -0.6), (1.3, -0.75), (1.1, 0.95)]):
        a, _, _ = T.build_arbre(MT, conifere=True)
        a.parent = root
        place(a, (x, y, 0.0), rot_z=i * 80, scale=0.5)
    return root


def build_cotes(parent, rnd):
    """Rochers le long des côtes + buissons épars."""
    for i in range(9):
        for _ in range(40):
            a = rnd.uniform(0, 2 * math.pi)
            d = rnd.uniform(0.86, 0.96)
            x = math.cos(a) * ISLE_RX * d
            y = math.sin(a) * ISLE_RY * d
            h = height(x, y)
            if 0.02 < h < 0.35 and math.hypot(x - PORT[0], y - PORT[1]) > 2.0:
                break
        else:
            continue
        r = build_rocher_a(parent, seed=50 + i) if i % 2 else build_rocher_b(parent, seed=50 + i)
        place(r, (x, y, h - 0.05), rot_z=rnd.uniform(0, 360), scale=rnd.uniform(0.45, 0.85))


def build_arbres_epars(parent_milieu, parent_premier, rnd):
    protos = [build_sapin(parent_milieu, seed=10), build_chene(parent_milieu, seed=10)]
    place(protos[0], (-2.2, 3.6, height(-2.2, 3.6) - 0.04), rot_z=80, scale=1.0)
    place(protos[1], (2.3, 2.6, height(2.3, 2.6) - 0.04), rot_z=10, scale=1.1)
    spots = [(-1.5, 1.8), (3.3, 4.0), (-3.2, -5.8), (-4.4, -4.0), (3.4, -5.6),
             (-2.0, -7.6), (4.6, -7.0), (-6.4, -3.0), (-7.6, -1.0), (1.9, 4.9),
             (-3.7, 3.4), (5.3, 3.4)]
    for i, (x, y) in enumerate(spots):
        h = height(x, y)
        if h < 0.18 or h > 1.4:
            continue
        if math.hypot(x - CITY[0], y - CITY[1]) < 3.3:
            continue
        grp = parent_premier if y < -5.0 else parent_milieu
        r = clone(protos[i % 2], 'arbre_e%d' % i, grp)
        place(r, (x, y, h - 0.04), rot_z=rnd.uniform(0, 360), scale=rnd.uniform(0.8, 1.3))
    MT = T.mats()
    for i, (x, y) in enumerate([(-1.6, -6.6), (2.6, -6.2), (-2.6, 2.2), (4.0, -3.4)]):
        h = height(x, y)
        if h < 0.15:
            continue
        b, _, _ = T.build_buisson(MT)
        grp = parent_premier if y < -5.0 else parent_milieu
        b.parent = grp
        place(b, (x, y, h - 0.02), rot_z=i * 70, scale=0.7)

# ---------------------------------------------------------------- ville -----


def build_ville(parent):
    MT = T.mats()
    c = G.empty('ville_root', parent, (CITY[0], CITY[1], 0.30))

    def put(fn, loc, rot=0.0, s=0.45):
        r, _, _ = fn(MT)
        r.parent = c
        place(r, (loc[0], loc[1], 0.0), rot_z=rot, scale=s)
        return r

    put(T.build_arene, (0.0, 1.30), 0, 0.50)
    put(T.build_fontaine, (0.0, -0.60), 0, 0.45)
    put(T.build_taverne, (-1.75, -0.45), 14, 0.45)
    put(T.build_banque, (1.75, -0.40), -10, 0.45)
    put(T.build_caserne, (-1.75, 1.05), -6, 0.45)
    put(T.build_marche, (0.95, -1.60), 4, 0.45)
    put(T.build_infirmerie, (-0.80, -1.70), 0, 0.42)
    put(T.build_puits, (1.50, 0.95), 0, 0.40)
    put(T.build_lampe, (0.62, -0.58), 0, 0.45)
    put(T.build_lampe, (-0.62, 0.45), 180, 0.45)
    for i, (x, y) in enumerate([(-2.45, -1.6), (2.45, -1.5), (2.3, 1.6), (-2.5, 1.9)]):
        a, _, _ = T.build_arbre(MT, conifere=True)
        a.parent = c
        place(a, (x, y, 0), rot_z=i * 50, scale=0.40)

    # remparts avec brèches aux portes (sud, ouest, nord, est)
    rx, ry = 2.85, 2.55
    gates = [math.atan2(p[0][1] - CITY[1], p[0][0] - CITY[0]) for p in PATHS.values()]
    nseg = 26
    for k in range(nseg):
        a = 2 * math.pi * k / nseg
        if any(abs(math.atan2(math.sin(a - g), math.cos(a - g))) < 0.26 for g in gates):
            continue
        x, y = rx * math.cos(a), ry * math.sin(a)
        fbox('mur%d' % k, c, (x, y, 0.20), (0.74, 0.17, 0.40), MT['pierre_clair'],
             rot=(0, 0, math.degrees(a) + 90))
        if k % 6 == 0:
            fcyl('mtour%d' % k, c, (x, y, 0.36), 0.20, 0.72, MT['pierre'], verts=9)
            fcone('mtoit%d' % k, c, (x, y, 0.82), 0.26, 0.02, 0.30, MT['tuile'], verts=9)
    # porte sud monumentale
    ga = gates[0]
    gx, gy = rx * math.cos(ga), ry * math.sin(ga)
    for i, sx in enumerate((-0.45, 0.45)):
        px = gx + sx * math.sin(ga) * -1
        py = gy + sx * math.cos(ga)
        fcyl('gtour%d' % i, c, (px, py, 0.42), 0.24, 0.84, MT['pierre'], verts=9)
        fcone('gtoit%d' % i, c, (px, py, 0.97), 0.30, 0.02, 0.36, MT['tuile_bleue'], verts=9)
        T.flag('gflag%d' % i, c, (px, py, 1.12), MT['bois'], MT['rouge'], h=0.4)
    return c


def build_port(parent):
    MT = T.mats()
    z0 = 0.18
    p = G.empty('port_root', parent, (PORT[0], PORT[1], 0.0))
    m1 = build_maison(p, seed=0)
    place(m1, (-0.95, 0.55, z0), rot_z=12, scale=0.55)
    m2 = build_maison(p, seed=1)
    place(m2, (0.45, 0.95, z0), rot_z=-9, scale=0.50)
    # jetée
    m_b = wmat('bois_clair')
    for k in range(6):
        y = -0.55 - 0.46 * k
        fbox('jetee%d' % k, p, (0.45, y, 0.16), (0.52, 0.48, 0.06), m_b)
        if k % 2 == 0:
            for sx in (-0.22, 0.22):
                fcyl('pilot%d%d' % (k, 0 if sx < 0 else 1), p, (0.45 + sx, y, -0.05),
                     0.05, 0.55, wmat('bois'), verts=6)
    nav = build_navire(p)
    place(nav, (1.45, -3.30, 0.02), rot_z=64, scale=0.85)
    cs, _, _ = T.build_caisses(MT)
    cs.parent = p
    place(cs, (0.95, 0.05, z0), rot_z=25, scale=0.42)
    lp, _, _ = T.build_lampe(MT)
    lp.parent = p
    place(lp, (0.05, -0.45, z0), rot_z=180, scale=0.45)
    # barque tirée sur la plage
    fsphere('barque', p, (-1.3, -1.5, 0.10), (0.22, 0.5, 0.14), wmat('coque'), seg=10, rings=6, smooth=False)
    return p

# ---------------------------------------------------------------- scène -----


def sun(name, energy, color, rot, angle=0.15):
    ld = bpy.data.lights.new(name, 'SUN')
    ld.energy = energy
    ld.color = color
    ld.angle = angle
    lo = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(lo)
    lo.rotation_euler = [radians(a) for a in rot]
    return lo


def map_stage(elev=55.0, dist=33.0, lens=35.0, target=(0.0, 0.6, 0.4)):
    sc = bpy.context.scene
    cd = bpy.data.cameras.new('mapcam')
    cd.lens = lens
    cd.clip_end = 500.0
    cam = bpy.data.objects.new('mapcam', cd)
    bpy.context.collection.objects.link(cam)
    e = radians(elev)
    cam.location = (target[0], target[1] - dist * math.cos(e), target[2] + dist * math.sin(e))
    cam.rotation_euler = (radians(90.0 - elev), 0, 0)
    sc.camera = cam
    sun('key', 3.2, (1.0, 0.94, 0.82), (42, 0, -38), 0.12)
    sun('fill', 0.8, (0.62, 0.75, 1.0), (55, 0, 145), 1.0)
    sun('rim', 1.1, (1.0, 0.72, 0.45), (-52, 0, 12), 0.4)
    w = sc.world
    if w and w.use_nodes:
        bg = w.node_tree.nodes['Background']
        bg.inputs[0].default_value = (0.62, 0.72, 0.85, 1.0)
        bg.inputs[1].default_value = 0.55
    return cam


def build_world(with_premier=True):
    """Construit toute la carte. Renvoie groupes + catchers + caméra à part."""
    random.seed(11)
    rnd = random.Random(7)
    fond = G.empty('GRP_fond')
    milieu = G.empty('GRP_milieu')
    premier = G.empty('GRP_premier')

    terrain = build_terrain(fond)
    sea = build_sea(fond)
    build_paths(fond)
    build_waves(fond, rnd)
    islet_root, islet_objs = build_islet_base(fond)

    build_montagnes(milieu)
    build_col(milieu)
    build_foret(milieu, rnd)
    build_clairiere(milieu)
    build_site_donjon(milieu, rnd)
    build_ile_magique(milieu)
    build_ile_colisee(milieu)
    build_cotes(milieu, rnd)
    build_arbres_epars(milieu, premier, rnd)

    pont = build_pont(milieu)
    # orientation du pont : perpendiculaire à la rivière, le long du chemin
    place(pont, (PONT_POS[0], PONT_POS[1], 0.08), rot_z=-50, scale=0.75)

    if with_premier:
        build_ville(premier)
        build_port(premier)

    return dict(
        groups={'fond': fond, 'milieu': milieu, 'premier': premier},
        catchers=[terrain, sea] + islet_objs,
    )
