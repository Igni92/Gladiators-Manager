# -*- coding: utf-8 -*-
"""Bibliotheque partagee pour les assets 3D de Gladiators Manager.

Personnage parametrique chibi-heroique SANS armature : hierarchie d'empties
(epaules/coudes/hanches/genoux/cou/colonne), poses = rotations des empties.
Utilise par les scripts render_*.py lances via:
    /opt/blender/blender -b -P script.py -- args
"""
import bpy
import math
from math import radians

OUT = "/home/user/Gladiators-Manager/tools/blender/out"
ASSETS = "/home/user/Gladiators-Manager/public/assets"

# ---------------------------------------------------------------- scene ----

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_render(res_x=128, res_y=128, samples=24, transparent=True):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 4
    sc.cycles.transparent_max_bounces = 8
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.render.resolution_x = res_x
    sc.render.resolution_y = res_y
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.45, 0.52, 0.65, 1.0)
    bg.inputs[1].default_value = 0.45
    return sc


def render_to(path):
    sc = bpy.context.scene
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

# ------------------------------------------------------------ materials ----

def mat(name, color, metallic=0.0, rough=0.55, emit=None, emit_strength=0.0, bump=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*emit, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit_strength
    if bump > 0:
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 40.0
        noise.inputs['Detail'].default_value = 8.0
        bmp = nt.nodes.new('ShaderNodeBump')
        bmp.inputs['Strength'].default_value = bump
        nt.links.new(noise.outputs['Fac'], bmp.inputs['Height'])
        nt.links.new(bmp.outputs['Normal'], bsdf.inputs['Normal'])
    return m

# ------------------------------------------------------------ primitives ----

def _setup(obj, parent, loc, rot, mat_, smooth=True):
    if parent is not None:
        obj.parent = parent
    obj.location = loc
    obj.rotation_euler = [radians(a) for a in rot]
    if mat_ is not None:
        obj.data.materials.append(mat_)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.05
    bpy.context.collection.objects.link(e)
    if parent is not None:
        e.parent = parent
    e.location = loc
    return e


def sphere(name, parent, loc, scale, mat_, rot=(0, 0, 0), seg=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1.0)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    return _setup(o, parent, loc, rot, mat_)


def cyl(name, parent, loc, r, depth, mat_, rot=(0, 0, 0), verts=20, origin='top'):
    """origin='top' -> le cylindre pend le long de -Z depuis loc."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth)
    o = bpy.context.active_object
    o.name = name
    if origin == 'top':
        # decale la geometrie pour que l'origine soit en haut
        for v in o.data.vertices:
            v.co.z -= depth / 2.0
    return _setup(o, parent, loc, rot, mat_)


def box(name, parent, loc, scale, mat_, rot=(0, 0, 0), bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    if bevel > 0:
        bv = o.modifiers.new('bv', 'BEVEL')
        bv.width = bevel
        bv.segments = 2
    return _setup(o, parent, loc, rot, mat_)


def cone(name, parent, loc, r1, r2, depth, mat_, rot=(0, 0, 0), verts=20):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth)
    o = bpy.context.active_object
    o.name = name
    return _setup(o, parent, loc, rot, mat_)


def torus(name, parent, loc, R, r, mat_, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r,
                                     major_segments=28, minor_segments=12)
    o = bpy.context.active_object
    o.name = name
    return _setup(o, parent, loc, rot, mat_)

# ------------------------------------------------------------- palettes ----

SKIN = (0.80, 0.55, 0.40)
SKIN2 = (0.62, 0.40, 0.28)
DARK = (0.06, 0.05, 0.05)
WOOD = (0.25, 0.15, 0.08)
LEATHER = (0.30, 0.18, 0.10)
STEEL = (0.52, 0.55, 0.60)

# 3 palettes (armure) par classe : variante portrait, v0 = sprites
PALETTES = {
    'colosse':   [(0.16, 0.14, 0.15), (0.30, 0.10, 0.08), (0.10, 0.14, 0.20)],
    'bretteur':  [(0.62, 0.65, 0.70), (0.65, 0.45, 0.12), (0.25, 0.30, 0.40)],
    'roublard':  [(0.10, 0.16, 0.10), (0.13, 0.12, 0.16), (0.22, 0.10, 0.10)],
    'lancier':   [(0.10, 0.28, 0.65), (0.65, 0.62, 0.60), (0.45, 0.10, 0.12)],
    'mage':      [(0.30, 0.10, 0.50), (0.10, 0.25, 0.45), (0.40, 0.08, 0.20)],
    'berserker': [(0.45, 0.25, 0.12), (0.25, 0.22, 0.20), (0.50, 0.12, 0.08)],
}

CLASSES = {
    #            scale  width  ortho  attaque
    'colosse':   (1.25, 1.30, 1.95, 'swing'),
    'bretteur':  (1.00, 1.00, 1.60, 'swing'),
    'roublard':  (0.92, 0.82, 1.42, 'dual'),
    'lancier':   (1.06, 0.90, 1.78, 'thrust'),
    'mage':      (1.00, 0.95, 1.72, 'swing'),
    'berserker': (1.12, 1.18, 1.78, 'swing'),
}

JOINTS = ['pelvis', 'spine', 'neck', 'shoulder_L', 'shoulder_R',
          'elbow_L', 'elbow_R', 'hip_L', 'hip_R', 'knee_L', 'knee_R',
          'grip_L', 'grip_R']

# ------------------------------------------------------------ character ----

def build_character(cls, variant=0, prefix=''):
    """Construit le personnage debout face -Y (S = face camera). Retourne rig dict."""
    s, w, ortho, atk = CLASSES[cls]
    P = PALETTES[cls][variant]
    n = prefix + cls + str(variant)

    m_armor = mat(n + '_armor', P, metallic=0.85 if cls != 'roublard' and cls != 'mage' else 0.1,
                  rough=0.35 if cls not in ('roublard', 'mage') else 0.6,
                  bump=0.030 if cls not in ('roublard', 'mage') else 0.08)
    m_skin = mat(n + '_skin', SKIN, rough=0.5)
    m_steel = mat('steel', STEEL, metallic=0.9, rough=0.3, bump=0.022)
    m_dark = mat('dark', DARK, rough=0.5)
    m_wood = mat('wood', WOOD, rough=0.7, bump=0.12)
    m_leather = mat('leather', LEATHER, rough=0.7, bump=0.10)
    m_gold = mat('gold', (0.95, 0.65, 0.16), metallic=1.0, rough=0.3)

    root = empty(n + '_root')
    rig = {'root': root, 'cls': cls, 'variant': variant, 's': s, 'w': w,
           'ortho': ortho, 'atk': atk, 'orb': None, 'objects': []}

    def S3(x, y, z):
        return (x * w * s, y * s, z * s)

    # ---- squelette d'empties
    pelvis = empty(n + '_pelvis', root, S3(0, 0, 0.64))
    spine = empty(n + '_spine', pelvis, S3(0, 0, 0.04))
    neck = empty(n + '_neck', spine, S3(0, 0, 0.62))
    sh_l = empty(n + '_shoulder_L', spine, S3(-0.36, 0, 0.55))
    sh_r = empty(n + '_shoulder_R', spine, S3(0.36, 0, 0.55))
    el_l = empty(n + '_elbow_L', sh_l, S3(0, 0, -0.28))
    el_r = empty(n + '_elbow_R', sh_r, S3(0, 0, -0.28))
    hip_l = empty(n + '_hip_L', pelvis, S3(-0.15, 0, 0))
    hip_r = empty(n + '_hip_R', pelvis, S3(0.15, 0, 0))
    kn_l = empty(n + '_knee_L', hip_l, S3(0, 0, -0.32))
    kn_r = empty(n + '_knee_R', hip_r, S3(0, 0, -0.32))
    grip_l = empty(n + '_grip_L', el_l, S3(0, 0, -0.30))
    grip_r = empty(n + '_grip_R', el_r, S3(0, 0, -0.30))

    for jn, ob in [('pelvis', pelvis), ('spine', spine), ('neck', neck),
                   ('shoulder_L', sh_l), ('shoulder_R', sh_r),
                   ('elbow_L', el_l), ('elbow_R', el_r),
                   ('hip_L', hip_l), ('hip_R', hip_r),
                   ('knee_L', kn_l), ('knee_R', kn_r),
                   ('grip_L', grip_l), ('grip_R', grip_r)]:
        rig[jn] = ob
    rig['base_loc'] = {j: tuple(rig[j].location) for j in JOINTS}

    mage_like = (cls == 'mage')
    bare = (cls == 'berserker')
    m_torso = m_skin if bare else m_armor

    # ---- torse
    sphere(n + '_chest', spine, S3(0, 0, 0.34), S3(0.36, 0.27, 0.40), m_torso)
    sphere(n + '_belly', spine, S3(0, 0, 0.10), S3(0.31, 0.26, 0.25),
           m_skin if bare else (m_armor if mage_like else m_leather))
    if not mage_like:
        # epaulieres
        pad = m_gold if cls == 'lancier' else (m_armor if not bare else mat('fur', (0.28, 0.18, 0.10), rough=0.9))
        sphere(n + '_padL', sh_l, S3(0, 0, 0.02), S3(0.16, 0.15, 0.13), pad)
        sphere(n + '_padR', sh_r, S3(0, 0, 0.02), S3(0.16, 0.15, 0.13), pad)
    if bare:
        # peintures de guerre : bandes rouges
        m_paint = mat('warpaint', (0.55, 0.05, 0.04), rough=0.6)
        sphere(n + '_paint1', spine, S3(0, -0.005, 0.42), S3(0.362, 0.272, 0.06), m_paint)
        sphere(n + '_paint2', spine, S3(0.10, -0.01, 0.30), S3(0.27, 0.272, 0.045), m_paint, rot=(0, 25, 0))

    # ---- tete
    head_mat = m_skin
    sphere(n + '_head', neck, S3(0, 0, 0.27), S3(0.33, 0.31, 0.33), head_mat)
    closed_helm = (cls == 'colosse' and variant in (0, 1))
    if not closed_helm:
        m_blanc = mat('eye_white', (0.95, 0.93, 0.88), rough=0.35)
        sphere(n + '_eyeWL', neck, S3(-0.115, -0.272, 0.30), S3(0.055, 0.032, 0.065), m_blanc)
        sphere(n + '_eyeWR', neck, S3(0.115, -0.272, 0.30), S3(0.055, 0.032, 0.065), m_blanc)
        sphere(n + '_eyeL', neck, S3(-0.115, -0.292, 0.30), S3(0.030, 0.020, 0.038), m_dark)
        sphere(n + '_eyeR', neck, S3(0.115, -0.292, 0.30), S3(0.030, 0.020, 0.038), m_dark)
        box(n + '_mouth', neck, S3(0, -0.30, 0.155), S3(0.085, 0.018, 0.016), m_dark, bevel=0.005)
        m_brow = mat(n + '_brow', (0.18, 0.10, 0.06), rough=0.8)
        box(n + '_browL', neck, S3(-0.115, -0.285, 0.385), S3(0.10, 0.04, 0.035), m_brow, rot=(0, 0, -8), bevel=0.01)
        box(n + '_browR', neck, S3(0.115, -0.285, 0.385), S3(0.10, 0.04, 0.035), m_brow, rot=(0, 0, 8), bevel=0.01)

    _headgear(rig, cls, variant, neck, S3,
              dict(armor=m_armor, steel=m_steel, dark=m_dark, gold=m_gold,
                   skin=m_skin, leather=m_leather, wood=m_wood))

    # ---- jambes
    if not mage_like:
        m_leg = m_leather if not bare else m_skin
        m_shin = m_steel if cls in ('bretteur', 'lancier', 'colosse') else (
            mat('fur', (0.28, 0.18, 0.10), rough=0.9) if bare else m_dark)
        for side, hip, knee in [('L', hip_l, kn_l), ('R', hip_r, kn_r)]:
            cyl(n + '_thigh' + side, hip, (0, 0, 0), 0.115 * w * s, 0.34 * s, m_leg)
            cyl(n + '_shin' + side, knee, (0, 0, 0), 0.095 * w * s, 0.28 * s, m_shin)
            box(n + '_foot' + side, knee, S3(0, -0.06, -0.27), S3(0.15, 0.27, 0.10), m_dark)
        # jupe/pteruges
        cone(n + '_skirt', pelvis, S3(0, 0, -0.04), 0.30 * w * s, 0.26 * w * s, 0.22 * s,
             m_leather if not bare else mat('fur', (0.28, 0.18, 0.10), rough=0.9))
    else:
        # robe longue du mage
        cone(n + '_robe', spine, S3(0, 0, -0.28), 0.42 * w * s, 0.30 * w * s, 0.72 * s, m_armor, verts=28)
        m_rune = mat('rune', (0.2, 0.9, 1.0), emit=(0.25, 0.9, 1.0), emit_strength=4.0)
        for i, (rx, rz) in enumerate([(-0.10, 0.0), (0.0, 0.10), (0.10, -0.05)]):
            sphere(n + '_rune%d' % i, spine, S3(rx, -0.38 + abs(rx) * 0.3, -0.25 + rz),
                   (0.025 * s,) * 3, m_rune)
        m_belt = mat(n + '_belt', (0.55, 0.42, 0.10), metallic=0.8, rough=0.4)
        torus(n + '_beltT', spine, S3(0, 0, 0.04), 0.30 * w * s, 0.035 * s, m_belt, rot=(0, 0, 0))

    # ---- bras
    m_arm = m_skin if (bare or cls in ('roublard',)) else (m_armor if mage_like else m_skin)
    m_fore = m_leather if not mage_like else m_armor
    for side, sh, el in [('L', sh_l, el_l), ('R', sh_r, el_r)]:
        cyl(n + '_uarm' + side, sh, (0, 0, 0), 0.10 * w * s, 0.30 * s, m_arm)
        cyl(n + '_farm' + side, el, (0, 0, 0), 0.085 * w * s, 0.26 * s, m_fore)
        sphere(n + '_hand' + side, el, S3(0, 0, -0.30), (0.115 * s,) * 3, m_skin)

    _weapons(rig, cls, variant, grip_l, grip_r, el_l, s, w,
             dict(armor=m_armor, steel=m_steel, dark=m_dark, gold=m_gold,
                  wood=m_wood, leather=m_leather))

    # ---- détails v2 : ceinture à boucle, brassards
    if not mage_like:
        torus(n + '_belt', pelvis, S3(0, 0, 0.085), 0.305 * w * s, 0.042 * s, m_leather)
        box(n + '_buckle', pelvis, S3(0, -0.305, 0.085), S3(0.09, 0.03, 0.07), m_gold, bevel=0.012)
    m_bracer = m_leather if cls in ('roublard', 'berserker') else m_steel
    for side, el in [('L', el_l), ('R', el_r)]:
        cyl(n + '_bracer' + side, el, (0, 0, -0.17 * s), 0.098 * w * s, 0.11 * s, m_bracer, origin='center')

    return rig


def _headgear(rig, cls, variant, neck, S3, M):
    n = rig['root'].name
    s, w = rig['s'], rig['w']
    if cls == 'bretteur':
        if variant in (0, 2):
            sphere(n + '_helm', neck, S3(0, 0.045, 0.315), S3(0.345, 0.33, 0.33), M['armor'])
            box(n + '_cheekL', neck, S3(-0.27, -0.16, 0.22), S3(0.10, 0.16, 0.22), M['armor'], rot=(0, 0, -15))
            box(n + '_cheekR', neck, S3(0.27, -0.16, 0.22), S3(0.10, 0.16, 0.22), M['armor'], rot=(0, 0, 15))
            m_crest = mat('crest_red', (0.72, 0.07, 0.06), rough=0.7) if variant == 0 else M['gold']
            box(n + '_crest', neck, S3(0, 0.03, 0.66), S3(0.07, 0.52, 0.20), m_crest, rot=(-8, 0, 0))
        else:
            m_hair = mat('hair_brn', (0.22, 0.12, 0.05), rough=0.85)
            sphere(n + '_hair', neck, S3(0, 0.05, 0.36), S3(0.335, 0.32, 0.28), m_hair)
    elif cls == 'colosse':
        sphere(n + '_helm', neck, S3(0, 0.0, 0.28), S3(0.37, 0.35, 0.37), M['armor'])
        m_cop = mat('copper', (0.72, 0.35, 0.16), metallic=1.0, rough=0.35)
        if variant in (0, 1):
            box(n + '_slit', neck, S3(0, -0.345, 0.28), S3(0.30, 0.04, 0.05), M['dark'], bevel=0.01)
            if variant == 0:
                cone(n + '_hornL', neck, S3(-0.36, 0, 0.42), 0.085 * s, 0.0, 0.26 * s, m_cop, rot=(0, -50, 0))
                cone(n + '_hornR', neck, S3(0.36, 0, 0.42), 0.085 * s, 0.0, 0.26 * s, m_cop, rot=(0, 50, 0))
            else:
                box(n + '_fin', neck, S3(0, 0.05, 0.62), S3(0.06, 0.42, 0.22), m_cop, rot=(-5, 0, 0))
        else:
            torus(n + '_brim', neck, S3(0, 0, 0.30), 0.36 * w * s, 0.05 * s, m_cop)
    elif cls == 'roublard':
        m_hood = M['armor']
        if variant in (0, 2):
            sphere(n + '_hood', neck, S3(0, 0.06, 0.33), S3(0.37, 0.37, 0.38), m_hood)
            cone(n + '_hoodtip', neck, S3(0, 0.22, 0.55), 0.16 * s, 0.0, 0.30 * s, m_hood, rot=(40, 0, 0))
            if variant == 2:
                box(n + '_mask', neck, S3(0, -0.30, 0.17), S3(0.40, 0.10, 0.16), M['dark'], bevel=0.02)
        else:
            box(n + '_bandana', neck, S3(0, 0, 0.44), S3(0.62, 0.60, 0.14), m_hood, bevel=0.04)
        m_scarf = mat('scarf', (0.16, 0.26, 0.16), rough=0.8)
        torus(n + '_scarf', neck, S3(0, 0, 0.06), 0.20 * w * s, 0.07 * s, m_scarf)
    elif cls == 'lancier':
        sphere(n + '_helm', neck, S3(0, 0.04, 0.315), S3(0.345, 0.33, 0.33), M['steel'])
        box(n + '_nose', neck, S3(0, -0.31, 0.26), S3(0.06, 0.06, 0.22), M['steel'], bevel=0.01)
        m_plume = mat('plume_w', (0.92, 0.92, 0.95), rough=0.9)
        if variant == 0:
            for i in range(3):
                sphere(n + '_plume%d' % i, neck, S3(0, 0.02 + 0.0 * i, 0.62 + 0.10 * (1 - abs(i - 1))),
                       S3(0.05, 0.10, 0.26), m_plume, rot=(-10 + 10 * i, 0, 0))
        elif variant == 1:
            for sx in (-0.12, 0.12):
                sphere(n + '_plume%s' % sx, neck, S3(sx, 0.02, 0.62), S3(0.05, 0.10, 0.26), m_plume)
        else:
            torus(n + '_crown', neck, S3(0, 0, 0.42), 0.26 * w * s, 0.045 * s, M['gold'])
    elif cls == 'mage':
        if variant == 0:
            m_hat = M['armor']
            cone(n + '_hatbrim', neck, S3(0, 0, 0.42), 0.44 * s, 0.40 * s, 0.04 * s, m_hat)
            cone(n + '_hat', neck, S3(0, 0.03, 0.62), 0.27 * s, 0.0, 0.46 * s, m_hat, rot=(8, 0, 0))
        elif variant == 1:
            sphere(n + '_hood', neck, S3(0, 0.06, 0.33), S3(0.37, 0.37, 0.38), M['armor'])
        else:
            m_hairg = mat('hair_grey', (0.75, 0.75, 0.72), rough=0.9)
            sphere(n + '_hair', neck, S3(0, 0.06, 0.34), S3(0.34, 0.33, 0.30), m_hairg)
            torus(n + '_circlet', neck, S3(0, 0, 0.40), 0.30 * w * s, 0.025 * s, M['gold'])
        if variant == 2 or variant == 0:
            m_beard = mat('beard_grey', (0.80, 0.80, 0.78), rough=0.9)
            cone(n + '_beard', neck, S3(0, -0.26, 0.02), 0.14 * s, 0.02 * s, 0.34 * s, m_beard, rot=(12, 0, 0))
    elif cls == 'berserker':
        m_hair = mat('hair_red', (0.42, 0.14, 0.04), rough=0.9)
        if variant == 0:
            sphere(n + '_hair', neck, S3(0, 0.07, 0.37), S3(0.36, 0.36, 0.32), m_hair)
            sphere(n + '_hair2', neck, S3(0, 0.22, 0.18), S3(0.25, 0.22, 0.30), m_hair)
        elif variant == 1:
            box(n + '_mohawk', neck, S3(0, 0.02, 0.60), S3(0.08, 0.50, 0.22), m_hair, bevel=0.03)
        else:
            torus(n + '_band', neck, S3(0, 0, 0.34), 0.31 * w * s, 0.04 * s, M['leather'])
            m_cop2 = mat('copper', (0.72, 0.35, 0.16), metallic=1.0, rough=0.35)
            cone(n + '_hL', neck, S3(-0.32, 0, 0.46), 0.07 * s, 0.0, 0.22 * s, m_cop2, rot=(0, -45, 0))
            cone(n + '_hR', neck, S3(0.32, 0, 0.46), 0.07 * s, 0.0, 0.22 * s, m_cop2, rot=(0, 45, 0))
        cone(n + '_beard', neck, S3(0, -0.25, 0.0), 0.16 * s, 0.03 * s, 0.36 * s, m_hair, rot=(10, 0, 0))


def _weapons(rig, cls, variant, grip_l, grip_r, el_l, s, w, M):
    n = rig['root'].name
    if cls == 'bretteur':
        grip_r.rotation_euler = (radians(-105), 0, 0)
        cyl(n + '_hilt', grip_r, (0, 0, -0.10 * s), 0.035 * s, 0.22 * s, M['leather'], origin='top')
        box(n + '_guard', grip_r, (0, 0, 0.10 * s), (0.16 * s, 0.05 * s, 0.04 * s), M['gold'])
        box(n + '_blade', grip_r, (0, 0, 0.36 * s), (0.075 * s, 0.025 * s, 0.50 * s), M['steel'], bevel=0.012)
        cone(n + '_tip', grip_r, (0, 0, 0.65 * s), 0.052 * s, 0.0, 0.09 * s, M['steel'], verts=4, rot=(0, 0, 45))
        # bouclier rond sur avant-bras gauche
        m_shield = mat('shield_red', (0.62, 0.10, 0.08), metallic=0.3, rough=0.45)
        sh = cyl(n + '_shield', el_l, (-0.10 * s * w, -0.06 * s, -0.16 * s), 0.30 * s, 0.05 * s,
                 m_shield, rot=(90, 0, 0), verts=28, origin='center')
        sphere(n + '_boss', el_l, (-0.10 * s * w, -0.115 * s, -0.16 * s), (0.07 * s,) * 3, M['gold'])
    elif cls == 'colosse':
        grip_r.rotation_euler = (radians(-100), 0, 0)
        m_cop = mat('copper', (0.72, 0.35, 0.16), metallic=1.0, rough=0.35)
        cyl(n + '_haft', grip_r, (0, 0, -0.22 * s), 0.04 * s, 0.5 * s, M['wood'], origin='top')
        cyl(n + '_haft2', grip_r, (0, 0, 0.42 * s), 0.04 * s, 0.42 * s, M['wood'], origin='top')
        sphere(n + '_macehead', grip_r, (0, 0, 0.50 * s), (0.17 * s,) * 3, M['armor'])
        for i in range(6):
            a = i * 60
            cone(n + '_spike%d' % i, grip_r,
                 (0.19 * s * math.cos(radians(a)), 0, 0.50 * s + 0.19 * s * math.sin(radians(a))),
                 0.05 * s, 0.0, 0.14 * s, m_cop, rot=(0, 90 + a, 0))
    elif cls == 'roublard':
        for g, side in [(grip_r, 1), (grip_l, -1)]:
            g.rotation_euler = (radians(-115), 0, 0)
            cyl(n + '_dhilt%d' % side, g, (0, 0, -0.07 * s), 0.028 * s, 0.13 * s, M['leather'], origin='top')
            box(n + '_dguard%d' % side, g, (0, 0, 0.065 * s), (0.10 * s, 0.04 * s, 0.03 * s), M['steel'])
            box(n + '_dblade%d' % side, g, (0, 0, 0.21 * s), (0.05 * s, 0.02 * s, 0.26 * s), M['steel'], bevel=0.01)
            cone(n + '_dtip%d' % side, g, (0, 0, 0.37 * s), 0.034 * s, 0.0, 0.07 * s, M['steel'], verts=4)
    elif cls == 'lancier':
        grip_r.rotation_euler = (radians(-12), 0, 0)
        cyl(n + '_spear', grip_r, (0, 0, 1.05 * s), 0.030 * s, 1.65 * s, M['wood'], origin='top')
        cone(n + '_spearhead', grip_r, (0, 0, 1.16 * s), 0.06 * s, 0.0, 0.24 * s, M['steel'], verts=8)
        m_shield = mat('shield_blue', (0.10, 0.28, 0.65), metallic=0.3, rough=0.45)
        cyl(n + '_shield', el_l, (-0.09 * s * w, -0.06 * s, -0.14 * s), 0.22 * s, 0.045 * s,
            m_shield, rot=(90, 0, 0), verts=24, origin='center')
        sphere(n + '_boss', el_l, (-0.09 * s * w, -0.10 * s, -0.14 * s), (0.05 * s,) * 3, M['gold'])
    elif cls == 'mage':
        grip_r.rotation_euler = (radians(-10), 0, 0)
        cyl(n + '_staff', grip_r, (0, 0, 0.85 * s), 0.030 * s, 1.35 * s, M['wood'], origin='top')
        m_cry = mat('crystal', (0.5, 0.2, 1.0), emit=(0.55, 0.25, 1.0), emit_strength=6.0)
        sphere(n + '_crystal', grip_r, (0, 0, 0.94 * s), (0.085 * s, 0.085 * s, 0.12 * s), m_cry, seg=12, rings=8)
        m_orb = mat('orb', (0.2, 0.9, 1.0), emit=(0.25, 0.85, 1.0), emit_strength=8.0)
        orb = sphere(n + '_orb', rig['root'], (0, -0.62 * s, 1.55 * s), (0.001,) * 3, m_orb, seg=16, rings=12)
        orb.hide_render = True
        rig['orb'] = orb
    elif cls == 'berserker':
        m_cop = mat('copper', (0.72, 0.35, 0.16), metallic=1.0, rough=0.35)
        for g, side in [(grip_r, 1), (grip_l, -1)]:
            g.rotation_euler = (radians(-105), 0, 0)
            cyl(n + '_ahaft%d' % side, g, (0, 0, -0.12 * s), 0.034 * s, 0.26 * s, M['wood'], origin='top')
            cyl(n + '_ahaft2%d' % side, g, (0, 0, 0.38 * s), 0.034 * s, 0.40 * s, M['wood'], origin='top')
            sphere(n + '_aneck%d' % side, g, (0, 0, 0.38 * s), (0.05 * s,) * 3, m_cop)
            # tete de hache : large lame trapezoidale d'un cote
            box(n + '_ablade%d' % side, g, (0.13 * s * side, 0, 0.36 * s),
                (0.20 * s, 0.035 * s, 0.26 * s), M['steel'], bevel=0.015)
            cone(n + '_aback%d' % side, g, (-0.07 * s * side, 0, 0.36 * s), 0.045 * s, 0.0, 0.10 * s,
                 m_cop, rot=(0, -90 * side, 0))

# ----------------------------------------------------------------- poses ----

def _mirror(p):
    """echange gauche/droite et inverse les signes ry/rz."""
    out = {}
    for k, v in p.items():
        if isinstance(v, tuple) and len(v) == 3:
            nk = k.replace('_L', '_X').replace('_R', '_L').replace('_X', '_R') \
                if ('_L' in k or '_R' in k) else k
            if '_L' in nk or '_R' in nk:
                out[nk] = (v[0], -v[1], -v[2])
            else:
                out[nk] = (v[0], -v[1], -v[2])
        else:
            out[k] = v
    return out


def get_pose(cls, anim, frame):
    """Retourne dict joint->(rx,ry,rz) degres + cles speciales
    pelvis_dz, pelvis_dy, root_rx, root_dz, orb_scale."""
    atk = CLASSES[cls][3]
    P = {}
    if anim == 'idle':
        if frame == 0:
            P = {'shoulder_L': (4, 10, 0), 'shoulder_R': (4, -10, 0),
                 'elbow_L': (-10, 0, 0), 'elbow_R': (-10, 0, 0)}
        else:
            P = {'shoulder_L': (2, 14, 0), 'shoulder_R': (2, -14, 0),
                 'elbow_L': (-14, 0, 0), 'elbow_R': (-14, 0, 0),
                 'spine': (-3, 0, 0), 'neck': (3, 0, 0), 'pelvis_dz': 0.035}
    elif anim == 'walk':
        A = {'hip_L': (-32, 0, 0), 'knee_L': (6, 0, 0),
             'hip_R': (26, 0, 0), 'knee_R': (48, 0, 0),
             'shoulder_L': (28, 8, 0), 'shoulder_R': (-30, -8, 0),
             'elbow_L': (-18, 0, 0), 'elbow_R': (-32, 0, 0),
             'spine': (-6, 0, 6), 'pelvis_dz': -0.02}
        B = {'hip_L': (4, 0, 0), 'knee_L': (10, 0, 0),
             'hip_R': (-6, 0, 0), 'knee_R': (14, 0, 0),
             'shoulder_L': (4, 10, 0), 'shoulder_R': (-4, -10, 0),
             'elbow_L': (-15, 0, 0), 'elbow_R': (-15, 0, 0),
             'spine': (-4, 0, 0), 'pelvis_dz': 0.015}
        P = [A, B, _mirror(A), _mirror(B)][frame]
    elif anim == 'attack':
        if atk == 'swing':
            P = [
                {'spine': (10, 0, -28), 'neck': (-6, 0, 18),
                 'shoulder_R': (148, -25, 0), 'elbow_R': (-85, 0, 0),
                 'shoulder_L': (-35, 18, 0), 'elbow_L': (-30, 0, 0),
                 'hip_L': (-8, 0, 0), 'hip_R': (10, 0, 0), 'knee_R': (14, 0, 0),
                 'pelvis_dz': -0.01},
                {'spine': (-18, 0, 16), 'neck': (10, 0, -8),
                 'shoulder_R': (-70, -12, 0), 'elbow_R': (-8, 0, 0),
                 'shoulder_L': (22, 22, 0), 'elbow_L': (-25, 0, 0),
                 'hip_L': (-28, 0, 0), 'knee_L': (8, 0, 0),
                 'hip_R': (22, 0, 0), 'knee_R': (38, 0, 0), 'pelvis_dz': -0.06},
                {'spine': (-26, 0, 26), 'neck': (14, 0, -12),
                 'shoulder_R': (-98, -5, 0), 'elbow_R': (-18, 0, 0),
                 'shoulder_L': (30, 26, 0), 'elbow_L': (-22, 0, 0),
                 'hip_L': (-28, 0, 0), 'knee_L': (8, 0, 0),
                 'hip_R': (24, 0, 0), 'knee_R': (42, 0, 0), 'pelvis_dz': -0.075},
                {'spine': (-8, 0, 6), 'shoulder_R': (-25, -10, 0), 'elbow_R': (-15, 0, 0),
                 'shoulder_L': (10, 12, 0), 'elbow_L': (-15, 0, 0),
                 'hip_L': (-12, 0, 0), 'hip_R': (10, 0, 0), 'knee_R': (18, 0, 0),
                 'pelvis_dz': -0.03},
            ][frame]
        elif atk == 'thrust':
            P = [
                {'spine': (8, 0, -22), 'shoulder_R': (38, -15, 0), 'elbow_R': (-95, 0, 0),
                 'grip_R': (-55, 0, 0),
                 'shoulder_L': (-30, 15, 0), 'elbow_L': (-30, 0, 0),
                 'hip_L': (-6, 0, 0), 'hip_R': (8, 0, 0)},
                {'spine': (-14, 0, 14), 'shoulder_R': (-78, -8, 0), 'elbow_R': (-6, 0, 0),
                 'grip_R': (-86, 0, 0),
                 'shoulder_L': (24, 20, 0), 'elbow_L': (-25, 0, 0),
                 'hip_L': (-30, 0, 0), 'knee_L': (8, 0, 0),
                 'hip_R': (24, 0, 0), 'knee_R': (42, 0, 0), 'pelvis_dz': -0.07},
                {'spine': (-18, 0, 18), 'shoulder_R': (-88, -4, 0), 'elbow_R': (-2, 0, 0),
                 'grip_R': (-88, 0, 0),
                 'shoulder_L': (28, 24, 0), 'elbow_L': (-22, 0, 0),
                 'hip_L': (-30, 0, 0), 'knee_L': (8, 0, 0),
                 'hip_R': (26, 0, 0), 'knee_R': (44, 0, 0), 'pelvis_dz': -0.075},
                {'spine': (-4, 0, 4), 'shoulder_R': (-30, -10, 0), 'elbow_R': (-30, 0, 0),
                 'grip_R': (-40, 0, 0), 'shoulder_L': (8, 12, 0), 'elbow_L': (-15, 0, 0),
                 'hip_L': (-10, 0, 0), 'hip_R': (8, 0, 0), 'knee_R': (14, 0, 0),
                 'pelvis_dz': -0.02},
            ][frame]
        else:  # dual (roublard)
            P = [
                {'spine': (12, 0, 0), 'shoulder_R': (55, -30, 0), 'elbow_R': (-100, 0, 0),
                 'shoulder_L': (55, 30, 0), 'elbow_L': (-100, 0, 0),
                 'hip_L': (-6, 0, 0), 'hip_R': (8, 0, 0), 'pelvis_dz': -0.04},
                {'spine': (-16, 0, 14), 'shoulder_R': (-80, -8, 0), 'elbow_R': (-10, 0, 0),
                 'shoulder_L': (30, 25, 0), 'elbow_L': (-60, 0, 0),
                 'hip_L': (-28, 0, 0), 'knee_L': (8, 0, 0),
                 'hip_R': (22, 0, 0), 'knee_R': (40, 0, 0), 'pelvis_dz': -0.06},
                {'spine': (-16, 0, -14), 'shoulder_L': (-80, 8, 0), 'elbow_L': (-10, 0, 0),
                 'shoulder_R': (30, -25, 0), 'elbow_R': (-60, 0, 0),
                 'hip_L': (-28, 0, 0), 'knee_L': (8, 0, 0),
                 'hip_R': (22, 0, 0), 'knee_R': (40, 0, 0), 'pelvis_dz': -0.06},
                {'spine': (-4, 0, 0), 'shoulder_R': (-20, -14, 0), 'elbow_R': (-30, 0, 0),
                 'shoulder_L': (-20, 14, 0), 'elbow_L': (-30, 0, 0),
                 'hip_L': (-10, 0, 0), 'hip_R': (8, 0, 0), 'pelvis_dz': -0.02},
            ][frame]
    elif anim == 'hit':
        P = {'spine': (26, 0, -6), 'neck': (18, 0, 0),
             'shoulder_L': (-45, 30, 0), 'shoulder_R': (-45, -30, 0),
             'elbow_L': (-35, 0, 0), 'elbow_R': (-35, 0, 0),
             'hip_L': (10, 0, 0), 'knee_L': (16, 0, 0),
             'hip_R': (4, 0, 0), 'knee_R': (10, 0, 0),
             'pelvis_dz': -0.04, 'pelvis_dy': 0.06}
    elif anim == 'death':
        if frame == 0:
            P = {'root_rx': -42, 'root_dz': 0.06,
                 'spine': (18, 0, -8), 'neck': (22, 0, 0),
                 'shoulder_L': (-70, 45, 0), 'shoulder_R': (-70, -45, 0),
                 'elbow_L': (-30, 0, 0), 'elbow_R': (-30, 0, 0),
                 'hip_L': (35, 0, 0), 'knee_L': (55, 0, 0),
                 'hip_R': (28, 0, 0), 'knee_R': (48, 0, 0)}
        else:
            P = {'root_rx': -84, 'root_dz': 0.26,
                 'spine': (12, 0, 0), 'neck': (26, 0, 0),
                 'shoulder_L': (-55, 70, 0), 'shoulder_R': (-55, -70, 0),
                 'elbow_L': (-20, 0, 0), 'elbow_R': (-20, 0, 0),
                 'hip_L': (55, 0, 0), 'knee_L': (75, 0, 0),
                 'hip_R': (45, 0, 0), 'knee_R': (65, 0, 0)}
    elif anim == 'cast':
        stages = [
            ({'spine': (4, 0, 0), 'shoulder_L': (-45, 12, 0), 'shoulder_R': (-45, -12, 0),
              'elbow_L': (-35, 0, 0), 'elbow_R': (-35, 0, 0), 'grip_R': (-30, 0, 0)}, 0.07),
            ({'spine': (8, 0, 0), 'shoulder_L': (-85, 15, 0), 'shoulder_R': (-85, -15, 0),
              'elbow_L': (-22, 0, 0), 'elbow_R': (-22, 0, 0), 'grip_R': (-15, 0, 0)}, 0.16),
            ({'spine': (12, 0, 0), 'neck': (-10, 0, 0),
              'shoulder_L': (-115, 18, 0), 'shoulder_R': (-115, -18, 0),
              'elbow_L': (-12, 0, 0), 'elbow_R': (-12, 0, 0), 'grip_R': (-5, 0, 0)}, 0.26),
            ({'spine': (16, 0, 0), 'neck': (-14, 0, 0),
              'shoulder_L': (-130, 20, 0), 'shoulder_R': (-130, -20, 0),
              'elbow_L': (-8, 0, 0), 'elbow_R': (-8, 0, 0), 'grip_R': (0, 0, 0),
              'pelvis_dz': 0.04}, 0.36),
        ]
        P, orb = stages[frame]
        P = dict(P)
        P['orb_scale'] = orb
    return P


def apply_pose(rig, pose, direction_deg=0.0):
    s = rig['s']
    # reset
    for j in JOINTS:
        ob = rig[j]
        if j.startswith('grip'):
            continue  # rotation par defaut posee par _weapons, geree ci-dessous
        ob.rotation_euler = (0, 0, 0)
        ob.location = rig['base_loc'][j]
    # grips : on memorise la rotation par defaut une fois
    if 'grip_default' not in rig:
        rig['grip_default'] = {g: tuple(rig[g].rotation_euler) for g in ('grip_L', 'grip_R')}
    for g in ('grip_L', 'grip_R'):
        rig[g].rotation_euler = rig['grip_default'][g]
        rig[g].location = rig['base_loc'][g]

    root = rig['root']
    root.rotation_mode = 'XYZ'
    rx = pose.get('root_rx', 0.0)
    root.rotation_euler = (radians(rx), 0, radians(direction_deg))
    root.location = (0, 0, pose.get('root_dz', 0.0) * s)

    for k, v in pose.items():
        if k in ('root_rx', 'root_dz', 'orb_scale', 'pelvis_dz', 'pelvis_dy'):
            continue
        ob = rig[k]
        if k.startswith('grip'):
            ob.rotation_euler = (radians(v[0]), radians(v[1]), radians(v[2]))
        else:
            ob.rotation_euler = (radians(v[0]), radians(v[1]), radians(v[2]))
    pel = rig['pelvis']
    bl = rig['base_loc']['pelvis']
    pel.location = (bl[0], bl[1] + pose.get('pelvis_dy', 0.0) * s,
                    bl[2] + pose.get('pelvis_dz', 0.0) * s)
    if rig['orb'] is not None:
        orb = rig['orb']
        osc = pose.get('orb_scale', 0.0)
        if osc > 0:
            orb.hide_render = False
            orb.scale = (osc * s,) * 3
        else:
            orb.hide_render = True

# ----------------------------------------------------------------- stage ----

def sprite_stage(ortho_scale, target_z, elev=55.0):
    """Camera ortho + eclairage sprites + shadow catcher. Retourne camera."""
    sc = bpy.context.scene
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = ortho_scale
    cam_data.clip_end = 100
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.collection.objects.link(cam)
    d = 14.0
    e = radians(elev)
    cam.location = (0, -d * math.cos(e), target_z + d * math.sin(e))
    cam.rotation_euler = (radians(90 - elev), 0, 0)
    sc.camera = cam

    def sun(name, energy, color, rot, angle=0.2):
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.color = color
        ld.angle = angle
        lo = bpy.data.objects.new(name, ld)
        bpy.context.collection.objects.link(lo)
        lo.rotation_euler = [radians(a) for a in rot]
        return lo

    sun('key', 3.0, (1.0, 0.96, 0.88), (50, 0, -35), 0.10)        # avant-gauche haut
    sun('fill', 0.9, (0.55, 0.70, 1.0), (62, 0, 40), 0.8)          # avant-droit froid
    sun('rim', 4.4, (1.0, 0.5, 0.2), (-48, 0, 20), 0.3)           # arriere chaud (torches)

    # petit disque catcher : alpha strictement nul au-dela
    bpy.ops.mesh.primitive_circle_add(vertices=40, radius=ortho_scale * 0.62,
                                      fill_type='NGON', location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = 'shadowcatcher'
    ground.is_shadow_catcher = True
    return cam


def portrait_stage(neck_world_z, scale=1.0):
    """Camera perspective 3/4 buste + eclairage 3 points dramatique."""
    sc = bpy.context.scene
    cam_data = bpy.data.cameras.new('pcam')
    cam_data.lens = 65
    cam = bpy.data.objects.new('pcam', cam_data)
    bpy.context.collection.objects.link(cam)
    # camera legerement au-dessus des yeux, 3/4 (decalee a gauche du perso)
    hz = neck_world_z + 0.28 * scale
    cam.location = (-1.25 * scale, -2.05 * scale, hz + 0.42 * scale)
    # vise la tete
    direction = (0.0 - cam.location.x, 0.0 - cam.location.y, hz - 0.04 * scale - cam.location.z)
    import mathutils
    rot = mathutils.Vector(direction).to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot.to_euler()
    sc.camera = cam

    def area(name, energy, color, loc, size, target):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.color = color
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        bpy.context.collection.objects.link(lo)
        lo.location = loc
        import mathutils as mu
        d = mu.Vector((target[0] - loc[0], target[1] - loc[1], target[2] - loc[2]))
        lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        return lo

    t = (0, 0, hz)
    area('key', 320 * scale * scale, (1.0, 0.92, 0.80), (-2.0 * scale, -1.7 * scale, hz + 1.3 * scale), 1.6, t)
    area('fill', 60 * scale * scale, (0.5, 0.65, 1.0), (2.2 * scale, -1.5 * scale, hz - 0.1 * scale), 2.4, t)
    area('rim', 420 * scale * scale, (1.0, 0.45, 0.12), (1.4 * scale, 2.2 * scale, hz + 1.0 * scale), 1.0, t)
    return cam
