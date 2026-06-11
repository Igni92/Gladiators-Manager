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

def mat(name, color, metallic=0.0, rough=0.55, emit=None, emit_strength=0.0,
        bump=0.0, sss=0.0, scales=0.0):
    """Materiau Principled. sss = Subsurface Weight (peau Pixar).
    scales = bump Voronoi (ecailles drakeide)."""
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
    if sss > 0:
        bsdf.inputs['Subsurface Weight'].default_value = sss
        bsdf.inputs['Subsurface Radius'].default_value = (0.05, 0.02, 0.014)
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*emit, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit_strength
    if scales > 0:
        vor = nt.nodes.new('ShaderNodeTexVoronoi')
        vor.inputs['Scale'].default_value = 55.0
        vor.feature = 'DISTANCE_TO_EDGE'
        bmp2 = nt.nodes.new('ShaderNodeBump')
        bmp2.inputs['Strength'].default_value = scales
        nt.links.new(vor.outputs['Distance'], bmp2.inputs['Height'])
        nt.links.new(bmp2.outputs['Normal'], bsdf.inputs['Normal'])
    elif bump > 0:
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

# ------------------------------------------------------------------ races ----
# h = hauteur globale, w = largeur, legs = longueur jambes, arms = bras,
# head = taille relative tete (chibi Pixar), skin = teinte peau,
# iris = couleur iris, hair = couleur cheveux.
RACES = {
    'humain': dict(h=1.00, w=1.00, legs=1.00, arms=1.00, head=1.00,
                   skin=(0.80, 0.55, 0.40), skin_f=(0.84, 0.60, 0.46),
                   iris=(0.10, 0.35, 0.75), hair=(0.26, 0.14, 0.06)),
    'elfe':   dict(h=1.05, w=0.88, legs=1.06, arms=1.00, head=0.97,
                   skin=(0.88, 0.66, 0.48), skin_f=(0.90, 0.70, 0.52),
                   iris=(0.10, 0.60, 0.32), hair=(0.90, 0.74, 0.38)),
    'nain':   dict(h=0.85, w=1.26, legs=0.60, arms=0.92, head=1.10,
                   skin=(0.78, 0.50, 0.36), skin_f=(0.82, 0.56, 0.42),
                   iris=(0.60, 0.38, 0.10), hair=(0.58, 0.22, 0.07)),
    'orc':    dict(h=1.07, w=1.22, legs=0.95, arms=1.10, head=1.05,
                   skin=(0.30, 0.50, 0.22), skin_f=(0.36, 0.55, 0.26),
                   iris=(0.78, 0.32, 0.08), hair=(0.07, 0.06, 0.07)),
    'gobelin': dict(h=0.76, w=0.85, legs=0.85, arms=1.06, head=1.18,
                    skin=(0.52, 0.62, 0.20), skin_f=(0.58, 0.66, 0.24),
                    iris=(0.88, 0.70, 0.08), hair=(0.18, 0.10, 0.05)),
    'drakeide': dict(h=1.04, w=1.08, legs=0.98, arms=1.00, head=1.02,
                     skin=(0.58, 0.16, 0.10), skin_f=(0.14, 0.30, 0.58),
                     iris=(0.92, 0.72, 0.12), hair=None),
}
RACE_LIST = ['humain', 'elfe', 'nain', 'orc', 'gobelin', 'drakeide']
CORPULENCE = {0: 0.88, 1: 1.00, 2: 1.18}

JOINTS = ['pelvis', 'spine', 'neck', 'shoulder_L', 'shoulder_R',
          'elbow_L', 'elbow_R', 'hip_L', 'hip_R', 'knee_L', 'knee_R',
          'grip_L', 'grip_R']

# ------------------------------------------------------------ character ----

def build_character(cls, race='humain', genre='m', corpulence=1, variant=0, prefix=''):
    """v3 — personnage Pixar fantasy debout face -Y. Retourne rig dict.
    Retro-compat : build_character(cls, 2) == variant=2, race humain."""
    if isinstance(race, int):           # ancien appel positionnel (cls, variant)
        variant, race = race, 'humain'
    s_c, w_c, ortho, atk = CLASSES[cls]
    R = RACES[race]
    corp = CORPULENCE.get(corpulence, 1.0)
    s = s_c * R['h']                    # echelle verticale globale
    w = w_c * R['w'] * corp             # facteur largeur global
    if w > 1.35:                        # amortit le cumul classe x race x corpulence
        w = 1.35 + (w - 1.35) * 0.45
    legf, armf, hf = R['legs'], R['arms'], R['head']
    fem = (genre == 'f')
    shf = 0.90 if fem else 1.0          # epaules
    hipf = 1.12 if fem else 1.0         # hanches
    P = PALETTES[cls][variant]
    n = prefix + '%s_%s_%s%d' % (race, genre, cls, variant)

    skin_col = R['skin_f'] if fem else R['skin']
    drak = (race == 'drakeide')
    m_armor = mat(n + '_armor', P, metallic=0.85 if cls != 'roublard' and cls != 'mage' else 0.1,
                  rough=0.35 if cls not in ('roublard', 'mage') else 0.6,
                  bump=0.030 if cls not in ('roublard', 'mage') else 0.08)
    m_skin = mat(n + '_skin', skin_col, rough=0.42, sss=0.09,
                 scales=0.35 if drak else 0.0)
    m_steel = mat('steel', STEEL, metallic=0.9, rough=0.3, bump=0.022)
    m_dark = mat('dark', DARK, rough=0.5)
    m_wood = mat('wood', WOOD, rough=0.7, bump=0.12)
    m_leather = mat('leather', LEATHER, rough=0.7, bump=0.10)
    m_gold = mat('gold', (0.95, 0.65, 0.16), metallic=1.0, rough=0.3)

    root = empty(n + '_root')
    rig = {'root': root, 'cls': cls, 'variant': variant, 's': s, 'w': w,
           'ortho': ortho * max(1.0, R['h']),
           'atk': atk, 'orb': None, 'objects': [],
           'race': race, 'genre': genre, 'corp': corpulence}

    def S3(x, y, z):
        return (x * w * s, y * s, z * s)

    # tete : largeur amortie (la tete ne s'elargit pas autant que le corps)
    whead = 1.0 + (w - 1.0) * 0.30
    def S3h(x, y, z):
        return (x * whead * s, y * s, z * s)

    # ---- squelette d'empties (API inchangee)
    pelvis = empty(n + '_pelvis', root, (0, 0, 0.64 * legf * s))
    spine = empty(n + '_spine', pelvis, S3(0, 0, 0.04))
    neck = empty(n + '_neck', spine, S3(0, 0, 0.62))
    sh_l = empty(n + '_shoulder_L', spine, (-0.36 * shf * w * s, 0, 0.55 * s))
    sh_r = empty(n + '_shoulder_R', spine, (0.36 * shf * w * s, 0, 0.55 * s))
    el_l = empty(n + '_elbow_L', sh_l, (0, 0, -0.28 * armf * s))
    el_r = empty(n + '_elbow_R', sh_r, (0, 0, -0.28 * armf * s))
    hip_l = empty(n + '_hip_L', pelvis, (-0.15 * hipf * w * s, 0, 0))
    hip_r = empty(n + '_hip_R', pelvis, (0.15 * hipf * w * s, 0, 0))
    kn_l = empty(n + '_knee_L', hip_l, (0, 0, -0.32 * legf * s))
    kn_r = empty(n + '_knee_R', hip_r, (0, 0, -0.32 * legf * s))
    grip_l = empty(n + '_grip_L', el_l, (0, 0, -0.30 * armf * s))
    grip_r = empty(n + '_grip_R', el_r, (0, 0, -0.30 * armf * s))

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

    # ---- torse (formes rondes et douces)
    chest_sc = (0.345 if fem else 0.36, 0.265, 0.40)
    sphere(n + '_chest', spine, S3(0, 0, 0.34), S3(*chest_sc), m_torso)
    if fem:
        sphere(n + '_bust', spine, S3(0, -0.05, 0.30), S3(0.30, 0.215, 0.165), m_torso)
        if bare:  # bandeau de tissu pour berserker f
            sphere(n + '_wrap', spine, S3(0, -0.015, 0.31), S3(0.35, 0.245, 0.13), m_leather)
    belly_sc = {0: (0.27, 0.225, 0.235), 1: (0.31, 0.26, 0.25), 2: (0.345, 0.30, 0.27)}[corpulence]
    if fem:
        belly_sc = (belly_sc[0] * 0.92, belly_sc[1] * 0.95, belly_sc[2])
    sphere(n + '_belly', spine, S3(0, 0, 0.10), S3(*belly_sc),
           m_skin if bare else (m_armor if mage_like else m_leather))
    if not mage_like:
        pad = m_gold if cls == 'lancier' else (m_armor if not bare else mat('fur', (0.28, 0.18, 0.10), rough=0.9))
        sphere(n + '_padL', sh_l, S3(0, 0, 0.02), S3(0.16, 0.15, 0.13), pad)
        sphere(n + '_padR', sh_r, S3(0, 0, 0.02), S3(0.16, 0.15, 0.13), pad)
    if bare and not fem:
        # bande de peinture de guerre diagonale uniquement (une bande
        # horizontale haute lisait comme une bouche geante sur les gabarits larges)
        m_paint = mat('warpaint', (0.55, 0.05, 0.04), rough=0.6)
        sphere(n + '_paint2', spine, S3(0.06, -0.012, 0.30),
               S3(0.30, chest_sc[1] + 0.008, 0.05), m_paint, rot=(0, 30, 0))

    # ---- tete : empty intermediaire scalee (taille raciale, hors squelette)
    # legerement remontee pour les gabarits larges (le torse monte au menton)
    headE = empty(n + '_headE', neck, (0, 0, 0.12 * s * max(0.0, w - 1.15)))
    headE.scale = (hf, hf, hf)
    sphere(n + '_head', headE, S3h(0, 0, 0.27), S3h(0.325, 0.30, 0.335), m_skin)

    M = dict(armor=m_armor, steel=m_steel, dark=m_dark, gold=m_gold,
             skin=m_skin, leather=m_leather, wood=m_wood)
    _face(rig, n, headE, S3h, M)
    covered = _headgear(rig, cls, variant, headE, S3h, M)
    _hair(rig, n, headE, S3h, M, covered)

    # ---- queue drakeide
    if drak:
        cone(n + '_tail', pelvis, (0, 0.20 * s, -0.04 * s), 0.10 * s, 0.015 * s,
             0.55 * s, m_skin, rot=(-55, 0, 0), verts=14)

    # ---- jambes
    if not mage_like:
        m_leg = m_leather if not bare else m_skin
        m_shin = m_steel if cls in ('bretteur', 'lancier', 'colosse') else (
            mat('fur', (0.28, 0.18, 0.10), rough=0.9) if bare else m_dark)
        for side, hip, knee in [('L', hip_l, kn_l), ('R', hip_r, kn_r)]:
            cyl(n + '_thigh' + side, hip, (0, 0, 0), 0.115 * w * s, 0.34 * legf * s, m_leg)
            cyl(n + '_shin' + side, knee, (0, 0, 0), 0.095 * w * s, 0.28 * legf * s, m_shin)
            box(n + '_foot' + side, knee, (0, -0.06 * s, -0.27 * legf * s),
                S3(0.15, 0.27, 0.10), m_dark)
        cone(n + '_skirt', pelvis, S3(0, 0, -0.04), 0.30 * w * s, 0.26 * w * s, 0.22 * legf * s,
             m_leather if not bare else mat('fur', (0.28, 0.18, 0.10), rough=0.9))
    else:
        robe_d = 0.72 * max(legf, 0.55) * s
        cone(n + '_robe', spine, (0, 0, -0.28 * legf * s - robe_d * 0.5 + 0.36 * legf * s),
             0.42 * w * s, 0.30 * w * s, robe_d, m_armor, verts=28)
        m_rune = mat('rune', (0.2, 0.9, 1.0), emit=(0.25, 0.9, 1.0), emit_strength=4.0)
        for i, (rx, rz) in enumerate([(-0.10, 0.0), (0.0, 0.10), (0.10, -0.05)]):
            sphere(n + '_rune%d' % i, spine, S3(rx, -0.38 + abs(rx) * 0.3, (-0.25 + rz) * legf),
                   (0.025 * s,) * 3, m_rune)
        m_belt = mat(n + '_belt', (0.55, 0.42, 0.10), metallic=0.8, rough=0.4)
        torus(n + '_beltT', spine, S3(0, 0, 0.04), 0.30 * w * s, 0.035 * s, m_belt, rot=(0, 0, 0))

    # ---- bras
    m_arm = m_skin if (bare or cls in ('roublard',)) else (m_armor if mage_like else m_skin)
    m_fore = m_leather if not mage_like else m_armor
    for side, sh, el in [('L', sh_l, el_l), ('R', sh_r, el_r)]:
        cyl(n + '_uarm' + side, sh, (0, 0, 0), 0.10 * w * s, 0.30 * armf * s, m_arm)
        cyl(n + '_farm' + side, el, (0, 0, 0), 0.085 * w * s, 0.26 * armf * s, m_fore)
        sphere(n + '_hand' + side, el, (0, 0, -0.30 * armf * s), (0.115 * s,) * 3, m_skin)

    _weapons(rig, cls, variant, grip_l, grip_r, el_l, s, w,
             dict(armor=m_armor, steel=m_steel, dark=m_dark, gold=m_gold,
                  wood=m_wood, leather=m_leather))

    # ---- ceinture, brassards
    if not mage_like:
        torus(n + '_belt', pelvis, S3(0, 0, 0.085), 0.305 * w * s, 0.042 * s, m_leather)
        box(n + '_buckle', pelvis, S3(0, -0.305, 0.085), S3(0.09, 0.03, 0.07), m_gold, bevel=0.012)
    m_bracer = m_leather if cls in ('roublard', 'berserker') else m_steel
    for side, el in [('L', el_l), ('R', el_r)]:
        cyl(n + '_bracer' + side, el, (0, 0, -0.17 * armf * s), 0.098 * w * s, 0.11 * s,
            m_bracer, origin='center')

    # reperes utiles pour cadrage cameras
    rig['neck_z'] = (0.64 * legf + 0.04 + 0.62) * s
    rig['height'] = rig['neck_z'] + (0.27 + 0.34) * s * hf
    return rig


# ------------------------------------------------------------- visage v3 ----

def _face(rig, n, headE, S3h, M):
    """Visage Pixar : grands yeux (blanc + iris + pupille + reflet),
    sourire, nez, oreilles et features raciales."""
    race, genre = rig['race'], rig['genre']
    R = RACES[race]
    s = rig['s']
    fem = (genre == 'f')
    m_skin = M['skin']
    m_white = mat('eye_white3', (0.96, 0.95, 0.92), rough=0.25)
    m_iris = mat('iris_' + race, R['iris'], rough=0.15,
                 emit=R['iris'], emit_strength=0.35)
    m_pupil = mat('pupil3', (0.02, 0.02, 0.025), rough=0.2)
    m_glint = mat('eye_glint', (1.0, 1.0, 1.0), rough=0.1,
                  emit=(1.0, 1.0, 1.0), emit_strength=2.0)
    m_lip = mat('lip3', (0.42, 0.16, 0.13), rough=0.55)
    hair_col = R['hair'] or (0.30, 0.28, 0.26)
    m_brow = mat(n + '_brow', hair_col if race != 'drakeide' else R['skin'], rough=0.8)

    # parametres raciaux des yeux
    ex, ez = 0.118, 0.305
    wsc = (0.085, 0.048, 0.105)   # blanc
    isc = (0.054, 0.030, 0.066)   # iris
    psc = (0.027, 0.020, 0.036)   # pupille
    erz = 0.0                     # rotation amande
    if race == 'elfe':
        wsc = (0.092, 0.044, 0.090); erz = 14
    elif race == 'gobelin':
        ex = 0.128; wsc = (0.10, 0.052, 0.118); isc = (0.064, 0.032, 0.078)
        psc = (0.034, 0.022, 0.044)
    elif race == 'orc':
        wsc = (0.080, 0.048, 0.088); ez = 0.295
    elif race == 'nain':
        wsc = (0.078, 0.048, 0.092)
    elif race == 'drakeide':
        wsc = (0.082, 0.046, 0.096)
        psc = (0.013, 0.020, 0.052)   # pupille fendue verticale

    for sd in (-1, 1):
        sfx = 'L' if sd < 0 else 'R'
        sphere(n + '_eyeW' + sfx, headE, S3h(sd * ex, -0.262, ez),
               S3h(*wsc), m_white, rot=(0, 0, -sd * erz))
        sphere(n + '_iris' + sfx, headE, S3h(sd * ex, -0.292, ez),
               S3h(*isc), m_iris)
        sphere(n + '_pupil' + sfx, headE, S3h(sd * ex, -0.305, ez),
               S3h(*psc), m_pupil)
        sphere(n + '_glint' + sfx, headE,
               S3h(sd * ex - 0.026, -0.322, ez + 0.034),
               S3h(0.0145, 0.010, 0.0145), m_glint, seg=12, rings=8)
        # cils marques pour f : trait fin au bord superieur de l'oeil
        if fem:
            box(n + '_lash' + sfx, headE, S3h(sd * ex, -0.292, ez + wsc[2] * 0.84),
                S3h(wsc[0] * 1.85, 0.018, 0.014), m_pupil, rot=(0, 0, -sd * (6 + erz)),
                bevel=0.004)

    # sourcils
    bz, bsc, brot = 0.408, (0.105, 0.042, 0.034), 9
    if race == 'orc':
        bz, bsc, brot = 0.388, (0.135, 0.060, 0.052), 12      # sourcils lourds
    elif race == 'drakeide':
        bz, bsc, brot = 0.415, (0.115, 0.055, 0.040), 8       # arcades ecailleuses
    if fem:
        bsc = (bsc[0] * 0.88, bsc[1] * 0.8, bsc[2] * 0.65)
        brot = max(3, brot - 5)
    box(n + '_browL', headE, S3h(-ex, -0.272, bz), S3h(*bsc), m_brow, rot=(0, 0, -brot), bevel=0.01)
    box(n + '_browR', headE, S3h(ex, -0.272, bz), S3h(*bsc), m_brow, rot=(0, 0, brot), bevel=0.01)

    # nez + museau
    if race == 'drakeide':
        sphere(n + '_snout', headE, S3h(0, -0.28, 0.20), S3h(0.155, 0.135, 0.115), m_skin)
        for sd in (-1, 1):  # narines
            sphere(n + '_nostril%d' % sd, headE, S3h(sd * 0.05, -0.405, 0.235),
                   S3h(0.016, 0.010, 0.013), m_pupil)
    elif race == 'nain':
        sphere(n + '_nose', headE, S3h(0, -0.315, 0.235), S3h(0.058, 0.052, 0.052), m_skin)
    elif race == 'gobelin':
        cone(n + '_nose', headE, S3h(0, -0.345, 0.235), 0.035 * s, 0.008 * s,
             0.14 * s, m_skin, rot=(96, 0, 0), verts=10)
    elif race == 'orc':
        sphere(n + '_nose', headE, S3h(0, -0.310, 0.230), S3h(0.060, 0.040, 0.038), m_skin)
    else:
        sphere(n + '_nose', headE, S3h(0, -0.305, 0.235), S3h(0.035, 0.030, 0.040), m_skin)

    # bouche souriante (tore incline : seul l'arc inferieur depasse)
    if race == 'drakeide':
        torus(n + '_smile', headE, S3h(0, -0.330, 0.135), 0.085 * s, 0.014 * s,
              m_lip, rot=(62, 0, 0))
    elif race == 'gobelin':
        torus(n + '_smile', headE, S3h(0, -0.252, 0.16), 0.115 * s, 0.016 * s,
              m_lip, rot=(60, 0, 0))
        for sd in (-1, 1):  # petites dents
            box(n + '_tooth%d' % sd, headE, S3h(sd * 0.055, -0.302, 0.115),
                S3h(0.020, 0.012, 0.024), m_white, bevel=0.004)
    elif race == 'orc':
        torus(n + '_smile', headE, S3h(0, -0.262, 0.155), 0.095 * s, 0.013 * s,
              m_lip, rot=(60, 0, 0))
        # machoire large + defenses vers le haut bien visibles
        sphere(n + '_jaw', headE, S3h(0, -0.085, 0.095), S3h(0.295, 0.26, 0.16), m_skin)
        m_tusk = mat('tusk_ivory', (0.97, 0.94, 0.85), rough=0.3)
        for sd in (-1, 1):
            cone(n + '_tusk%d' % sd, headE, S3h(sd * 0.115, -0.30, 0.155),
                 0.034 * s, 0.005 * s, 0.15 * s, m_tusk, rot=(-14, 0, sd * 16), verts=10)
    else:
        torus(n + '_smile', headE, S3h(0, -0.255, 0.165), 0.082 * s, 0.0135 * s,
              m_lip, rot=(62, 0, 0))

    # oreilles
    if race == 'elfe':
        for sd in (-1, 1):
            cone(n + '_ear%d' % sd, headE, S3h(sd * 0.36, 0.01, 0.315),
                 0.048 * s, 0.005 * s, 0.30 * s, m_skin,
                 rot=(0, sd * 78, sd * 16), verts=10)
    elif race == 'gobelin':
        for sd in (-1, 1):
            cone(n + '_ear%d' % sd, headE, S3h(sd * 0.40, 0.02, 0.32),
                 0.075 * s, 0.008 * s, 0.36 * s, m_skin,
                 rot=(0, sd * 80, sd * 6), verts=10)
    elif race == 'orc':
        for sd in (-1, 1):
            cone(n + '_ear%d' % sd, headE, S3h(sd * 0.31, 0.01, 0.31),
                 0.042 * s, 0.006 * s, 0.13 * s, m_skin, rot=(0, sd * 82, 0), verts=10)
    elif race in ('humain', 'nain'):
        for sd in (-1, 1):
            sphere(n + '_ear%d' % sd, headE, S3h(sd * 0.305, 0.0, 0.28),
                   S3h(0.045, 0.05, 0.06), m_skin)

    # cornes drakeide (2 segments, bone)
    if race == 'drakeide':
        m_bone = mat('horn_bone', (0.88, 0.84, 0.74), rough=0.45)
        for sd in (-1, 1):
            cone(n + '_horn%d' % sd, headE, S3h(sd * 0.145, 0.085, 0.50),
                 0.055 * s, 0.022 * s, 0.20 * s, m_bone, rot=(-32, 0, sd * 14), verts=12)
            cone(n + '_horntip%d' % sd, headE, S3h(sd * 0.185, 0.165, 0.625),
                 0.024 * s, 0.002 * s, 0.14 * s, m_bone, rot=(-58, 0, sd * 18), verts=10)

    # barbe naine (m) : enorme, tressee
    if race == 'nain':
        m_hair = mat('hair_nain', R['hair'], rough=0.85)
        if not fem:
            # barbe drapee DEVANT le torse (rot 30 deg, bien en avant)
            cone(n + '_beard', headE, S3h(0, -0.30, -0.07), 0.21 * s, 0.05 * s,
                 0.46 * s, m_hair, rot=(26, 0, 0), verts=16)
            for sd in (-1, 1):  # tresses + anneaux dores
                cyl(n + '_braid%d' % sd, headE, S3h(sd * 0.10, -0.30, 0.06),
                    0.038 * s, 0.32 * s, m_hair, rot=(22, 0, sd * 7))
                torus(n + '_ring%d' % sd, headE, S3h(sd * 0.135, -0.40, -0.16),
                      0.042 * s, 0.014 * s, M['gold'], rot=(70, 0, sd * 7))
            # moustache
            for sd in (-1, 1):
                sphere(n + '_mous%d' % sd, headE, S3h(sd * 0.065, -0.305, 0.150),
                       S3h(0.065, 0.030, 0.030), m_hair, rot=(0, 0, -sd * 22))
        else:  # f : deux tresses laterales
            for sd in (-1, 1):
                cyl(n + '_braid%d' % sd, headE, S3h(sd * 0.24, -0.10, 0.10),
                    0.045 * s, 0.34 * s, m_hair, rot=(6, 0, sd * 10))
                torus(n + '_ring%d' % sd, headE, S3h(sd * 0.275, -0.135, -0.20),
                      0.048 * s, 0.015 * s, M['gold'], rot=(80, 0, sd * 10))


def _hair(rig, n, headE, S3h, M, covered):
    """Cheveux raciaux : crane (si non couvert) + cheveux longs dans le dos."""
    race, genre = rig['race'], rig['genre']
    R = RACES[race]
    s = rig['s']
    fem = (genre == 'f')
    if R['hair'] is None:       # drakeide : pas de cheveux, crete dorsale
        if not covered:
            m_bone = mat('horn_bone', (0.88, 0.84, 0.74), rough=0.45)
            for i, (dy, dz, sc) in enumerate([(0.10, 0.52, 0.05), (0.18, 0.44, 0.04), (0.235, 0.33, 0.032)]):
                cone(n + '_crest%d' % i, headE, S3h(0, dy, dz), sc * s, 0.004 * s,
                     0.10 * s, m_bone, rot=(35 + 18 * i, 0, 0), verts=8)
        return
    m_hair = mat('hair_' + race, R['hair'], rough=0.85)
    if not covered:
        sphere(n + '_hairc', headE, S3h(0, 0.05, 0.36), S3h(0.335, 0.315, 0.295), m_hair)
        # meche frontale douce
        sphere(n + '_fringe', headE, S3h(0, -0.235, 0.435), S3h(0.24, 0.115, 0.10), m_hair, rot=(18, 0, 0))
    if fem:
        # chevelure longue dans le dos (compatible casque)
        sphere(n + '_hairb', headE, S3h(0, 0.215, 0.06), S3h(0.255, 0.175, 0.40), m_hair)
        if race == 'elfe':      # longue tresse
            cyl(n + '_braidb', headE, S3h(0, 0.27, -0.10), 0.052 * s, 0.42 * s,
                m_hair, rot=(-14, 0, 0))
            sphere(n + '_braidtip', headE, S3h(0, 0.355, -0.50), S3h(0.055, 0.055, 0.085), m_hair)
            torus(n + '_btie', headE, S3h(0, 0.335, -0.42), 0.05 * s, 0.013 * s,
                  M['gold'], rot=(76, 0, 0))
    elif race == 'elfe':
        # elfe m : cheveux mi-longs
        sphere(n + '_hairb', headE, S3h(0, 0.19, 0.10), S3h(0.27, 0.16, 0.30), m_hair)


def _headgear(rig, cls, variant, headE, S3h, M):
    """Couvre-chef de classe (parente a headE, donc suit la taille raciale).
    Retourne True si le crane est couvert (pas de cheveux a poser)."""
    n = rig['root'].name[:-5]  # retire '_root'
    s, w = rig['s'], rig['w']
    race = rig.get('race', 'humain')
    S3 = S3h
    covered = True
    no_class_beard = race in ('nain', 'elfe', 'gobelin', 'drakeide', 'orc') or rig.get('genre') == 'f'
    if cls == 'bretteur':
        if variant in (0, 2):
            sphere(n + '_helm', headE, S3(0, 0.055, 0.34), S3(0.345, 0.325, 0.30), M['armor'])
            box(n + '_cheekL', headE, S3(-0.27, -0.16, 0.22), S3(0.10, 0.16, 0.22), M['armor'], rot=(0, 0, -15))
            box(n + '_cheekR', headE, S3(0.27, -0.16, 0.22), S3(0.10, 0.16, 0.22), M['armor'], rot=(0, 0, 15))
            m_crest = mat('crest_red', (0.72, 0.07, 0.06), rough=0.7) if variant == 0 else M['gold']
            box(n + '_crest', headE, S3(0, 0.03, 0.66), S3(0.07, 0.52, 0.20), m_crest, rot=(-8, 0, 0))
        else:
            covered = False
    elif cls == 'colosse':
        # v3 : casque OUVERT (le visage Pixar doit rester visible)
        sphere(n + '_helm', headE, S3(0, 0.06, 0.37), S3(0.355, 0.33, 0.30), M['armor'])
        m_cop = mat('copper', (0.72, 0.35, 0.16), metallic=1.0, rough=0.35)
        torus(n + '_brim', headE, S3(0, 0.045, 0.335), 0.345 * s, 0.05 * s, m_cop, rot=(10, 0, 0))
        if variant == 0:
            cone(n + '_hornL', headE, S3(-0.36, 0.05, 0.48), 0.105 * s, 0.0, 0.34 * s, m_cop, rot=(0, -52, 0))
            cone(n + '_hornR', headE, S3(0.36, 0.05, 0.48), 0.105 * s, 0.0, 0.34 * s, m_cop, rot=(0, 52, 0))
        elif variant == 1:
            box(n + '_fin', headE, S3(0, 0.07, 0.64), S3(0.06, 0.42, 0.22), m_cop, rot=(-5, 0, 0))
    elif cls == 'roublard':
        m_hood = M['armor']
        if variant in (0, 2):
            sphere(n + '_hood', headE, S3(0, 0.06, 0.33), S3(0.37, 0.37, 0.38), m_hood)
            cone(n + '_hoodtip', headE, S3(0, 0.22, 0.55), 0.16 * s, 0.0, 0.30 * s, m_hood, rot=(40, 0, 0))
            if variant == 2:
                box(n + '_mask', headE, S3(0, -0.30, 0.17), S3(0.40, 0.10, 0.16), M['dark'], bevel=0.02)
        else:
            box(n + '_bandana', headE, S3(0, 0, 0.44), S3(0.62, 0.60, 0.14), m_hood, bevel=0.04)
        m_scarf = mat('scarf', (0.16, 0.26, 0.16), rough=0.8)
        torus(n + '_scarf', headE, S3(0, 0, 0.06), 0.20 * w * s, 0.07 * s, m_scarf)
    elif cls == 'lancier':
        sphere(n + '_helm', headE, S3(0, 0.05, 0.345), S3(0.345, 0.325, 0.30), M['steel'])
        m_plume = mat('plume_w', (0.92, 0.92, 0.95), rough=0.9)
        if variant == 0:
            for i in range(3):
                sphere(n + '_plume%d' % i, headE, S3(0, 0.02 + 0.0 * i, 0.62 + 0.10 * (1 - abs(i - 1))),
                       S3(0.05, 0.10, 0.26), m_plume, rot=(-10 + 10 * i, 0, 0))
        elif variant == 1:
            for sx in (-0.12, 0.12):
                sphere(n + '_plume%s' % sx, headE, S3(sx, 0.02, 0.62), S3(0.05, 0.10, 0.26), m_plume)
        else:
            torus(n + '_crown', headE, S3(0, 0, 0.42), 0.26 * w * s, 0.045 * s, M['gold'])
    elif cls == 'mage':
        if variant == 0:
            # chapeau pointu repousse vers l'arriere : le visage reste visible
            # depuis la camera sprite (elevation 55 deg)
            m_hat = M['armor']
            cone(n + '_hatbrim', headE, S3(0, 0.085, 0.475), 0.42 * s, 0.36 * s, 0.045 * s,
                 m_hat, rot=(17, 0, 0), verts=24)
            cone(n + '_hat', headE, S3(0, 0.15, 0.65), 0.24 * s, 0.0, 0.44 * s, m_hat, rot=(24, 0, 0))
            sphere(n + '_hattip', headE, S3(0, 0.285, 0.825), S3(0.05, 0.05, 0.05), m_hat)
            torus(n + '_hatband', headE, S3(0, 0.10, 0.50), 0.245 * s, 0.025 * s,
                  M['gold'], rot=(17, 0, 0))
        elif variant == 1:
            sphere(n + '_hood', headE, S3(0, 0.06, 0.33), S3(0.37, 0.37, 0.38), M['armor'])
        else:
            covered = False
            torus(n + '_circlet', headE, S3(0, 0, 0.42), 0.30 * s, 0.025 * s, M['gold'])
        if (variant == 2 or variant == 0) and not no_class_beard:
            m_beard = mat('beard_grey', (0.80, 0.80, 0.78), rough=0.9)
            cone(n + '_beard', headE, S3(0, -0.26, 0.02), 0.14 * s, 0.02 * s, 0.34 * s, m_beard, rot=(12, 0, 0))
    elif cls == 'berserker':
        hair_col = RACES[race]['hair'] or (0.42, 0.14, 0.04)
        m_hair = mat('hair_bz_' + race, hair_col, rough=0.9)
        if variant == 0:
            if race != 'drakeide':
                sphere(n + '_hairA', headE, S3(0, 0.07, 0.37), S3(0.355, 0.35, 0.31), m_hair)
                sphere(n + '_hair2', headE, S3(0, 0.22, 0.18), S3(0.25, 0.22, 0.30), m_hair)
            else:
                covered = False
        elif variant == 1:
            box(n + '_mohawk', headE, S3(0, 0.02, 0.60), S3(0.08, 0.50, 0.22), m_hair, bevel=0.03)
            covered = (race == 'drakeide')
        else:
            torus(n + '_band', headE, S3(0, 0, 0.34), 0.31 * s, 0.04 * s, M['leather'])
            m_cop2 = mat('copper', (0.72, 0.35, 0.16), metallic=1.0, rough=0.35)
            cone(n + '_hL', headE, S3(-0.32, 0, 0.46), 0.07 * s, 0.0, 0.22 * s, m_cop2, rot=(0, -45, 0))
            cone(n + '_hR', headE, S3(0.32, 0, 0.46), 0.07 * s, 0.0, 0.22 * s, m_cop2, rot=(0, 45, 0))
            covered = False
        if not no_class_beard:
            cone(n + '_beardb', headE, S3(0, -0.25, 0.0), 0.16 * s, 0.03 * s, 0.36 * s, m_hair, rot=(10, 0, 0))
    return covered


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
