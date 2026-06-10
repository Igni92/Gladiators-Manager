# -*- coding: utf-8 -*-
"""Modelisation procedurale des batiments de la ville (fantasy mediterraneenne)."""
import math
from math import radians

import bpy
import gmlib as G

# ------------------------------------------------------------- materiaux ----

def mats():
    return dict(
        platre=G.mat('platre', (0.82, 0.74, 0.58), rough=0.8),
        platre_blanc=G.mat('platre_blanc', (0.92, 0.90, 0.84), rough=0.8),
        pierre=G.mat('pierre', (0.52, 0.48, 0.42), rough=0.85),
        pierre_clair=G.mat('pierre_clair', (0.70, 0.66, 0.58), rough=0.85),
        tuile=G.mat('tuile', (0.58, 0.20, 0.10), rough=0.7),
        tuile_bleue=G.mat('tuile_bleue', (0.12, 0.25, 0.40), rough=0.6),
        bois=G.mat('bois_fonce', (0.18, 0.10, 0.05), rough=0.8),
        bois_clair=G.mat('bois_clair', (0.45, 0.28, 0.13), rough=0.75),
        toile_rouge=G.mat('toile_rouge', (0.65, 0.12, 0.08), rough=0.85),
        toile_creme=G.mat('toile_creme', (0.88, 0.82, 0.68), rough=0.85),
        toile_verte=G.mat('toile_verte', (0.15, 0.40, 0.20), rough=0.85),
        or_=G.mat('gold', (0.95, 0.65, 0.16), metallic=1.0, rough=0.3),
        fer=G.mat('fer', (0.35, 0.37, 0.40), metallic=0.9, rough=0.45),
        sable=G.mat('sable', (0.80, 0.68, 0.45), rough=0.95),
        feuillage=G.mat('feuillage', (0.18, 0.38, 0.14), rough=0.9),
        feuillage_olive=G.mat('feuillage_olive', (0.35, 0.45, 0.22), rough=0.9),
        eau=G.mat('eau', (0.15, 0.45, 0.60), rough=0.1, emit=(0.1, 0.4, 0.6), emit_strength=0.4),
        flamme=G.mat('flamme', (1.0, 0.55, 0.1), emit=(1.0, 0.45, 0.08), emit_strength=12.0),
        lanterne=G.mat('lanterne', (1.0, 0.75, 0.3), emit=(1.0, 0.7, 0.25), emit_strength=6.0),
        rouge=G.mat('banniere_rouge', (0.62, 0.08, 0.06), rough=0.8),
        blanc=G.mat('blanc', (0.9, 0.9, 0.9), rough=0.7),
    )

# ------------------------------------------------------------- elements -----

def gable_roof(name, root, loc, w, d, h, m, ridge_m=None):
    """Toit a deux pentes : prisme triangulaire le long de Y."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=3, radius=1.0, depth=1.0)
    o = bpy.context.active_object
    o.name = name
    o.parent = root
    o.rotation_euler = (radians(-90), radians(-90), 0)
    o.scale = (h, w / 2 * 1.6, d / 2)
    o.location = loc
    o.data.materials.append(m)
    if ridge_m:
        G.box(name + '_ridge', root, (loc[0], loc[1], loc[2] + h * 0.96), (w * 0.08, d * 1.02, 0.05), ridge_m)
    return o


def crenellations(name, root, cx, cy, z, w, d, m, n=5, s=0.16):
    for i in range(n):
        t = i / (n - 1) - 0.5
        G.box(name + '_cw%d' % i, root, (cx + t * w, cy - d / 2, z), (s, s, s * 1.4), m)
        G.box(name + '_ce%d' % i, root, (cx + t * w, cy + d / 2, z), (s, s, s * 1.4), m)
    for i in range(n - 2):
        t = (i + 1) / (n - 1) - 0.5
        G.box(name + '_cn%d' % i, root, (cx - w / 2, cy + t * d, z), (s, s, s * 1.4), m)
        G.box(name + '_cs%d' % i, root, (cx + w / 2, cy + t * d, z), (s, s, s * 1.4), m)


def flag(name, root, loc, m_pole, m_cloth, h=0.9):
    G.cyl(name + '_pole', root, (loc[0], loc[1], loc[2] + h), 0.025, h, m_pole, origin='top')
    G.box(name + '_cloth', root, (loc[0] + 0.22, loc[1], loc[2] + h - 0.16), (0.42, 0.03, 0.26), m_cloth, bevel=0.01)


def torch(name, root, loc, M, h=0.8):
    G.cyl(name + '_p', root, (loc[0], loc[1], loc[2] + h), 0.035, h, M['bois'], origin='top')
    G.cyl(name + '_cup', root, (loc[0], loc[1], loc[2] + h + 0.05), 0.09, 0.12, M['fer'], origin='top')
    G.sphere(name + '_fl', root, (loc[0], loc[1], loc[2] + h + 0.12), (0.09, 0.09, 0.14), M['flamme'])

# ------------------------------------------------------------- batiments ----

def build_arene(M):
    root = G.empty('arene_root')
    # 3 anneaux elliptiques empiles
    for i, (rx, ry, h, m) in enumerate([
        (2.3, 1.75, 0.85, M['pierre']),
        (2.0, 1.5, 0.65, M['pierre_clair']),
        (1.7, 1.25, 0.5, M['pierre']),
    ]):
        z = [0.42, 1.0, 1.45][i]
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1.0, depth=h)
        o = bpy.context.active_object
        o.name = 'ring%d' % i
        o.parent = root
        o.scale = (rx, ry, 1.0)
        o.location = (0, 0, z)
        o.data.materials.append(m)
        for p in o.data.polygons:
            p.use_smooth = True
    # arcades : trous suggeres par boites sombres sur l'anneau du bas
    for k in range(14):
        a = k / 14 * 2 * math.pi
        G.box('arch%d' % k, root, (2.28 * math.cos(a), 1.73 * math.sin(a), 0.38),
              (0.16, 0.22, 0.42), M['bois'], rot=(0, 0, math.degrees(a)))
    # piste de sable au centre (legerement au-dessus)
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=1.0, depth=0.06)
    sand = bpy.context.active_object
    sand.parent = root
    sand.scale = (1.55, 1.1, 1.0)
    sand.location = (0, 0, 1.72)
    sand.data.materials.append(M['sable'])
    # oriflammes
    for a_deg in (20, 90, 160, 200, 270, 340):
        a = radians(a_deg)
        flag('fl%d' % a_deg, root, (1.7 * math.cos(a), 1.27 * math.sin(a), 1.7), M['bois'], M['rouge'], h=0.7)
    return root, 5.6, 1.2


def build_marche(M):
    root = G.empty('marche_root')
    # deux etals avec auvents rayes
    for i, (x, ry, m_toile) in enumerate([(-0.85, 0, M['toile_rouge']), (0.85, 12, M['toile_creme'])]):
        st = G.empty('stand%d' % i, root, (x, 0, 0))
        st.rotation_euler = (0, 0, radians(ry))
        G.box('table%d' % i, st, (0, 0, 0.42), (1.3, 0.8, 0.10), M['bois_clair'])
        for sx in (-0.55, 0.55):
            for sy in (-0.3, 0.3):
                G.box('leg%d%s%s' % (i, sx, sy), st, (sx, sy, 0.2), (0.08, 0.08, 0.42), M['bois'])
        for k, px in enumerate((-0.6, -0.2, 0.2, 0.6)):
            G.cyl('post%d%d' % (i, k), st, (px, -0.45 + (0.9 if k % 2 else 0), 1.15), 0.03, 1.15, M['bois'], origin='top')
        # auvent raye : bandes alternees
        for k in range(5):
            m = m_toile if k % 2 == 0 else M['blanc']
            G.box('awn%d%d' % (i, k), st, (-0.52 + k * 0.26, 0, 1.18), (0.27, 1.15, 0.04), m, rot=(8, 0, 0))
        # marchandises : casques et armes
        G.sphere('helm%d' % i, st, (-0.3, 0.1, 0.55), (0.14, 0.13, 0.12), M['fer'])
        G.box('crate%d' % i, st, (0.35, -0.1, 0.55), (0.25, 0.25, 0.2), M['bois_clair'])
    # cage doree (gladiateurs a vendre…)
    cage = G.empty('cage', root, (0, 0.95, 0))
    for k in range(8):
        a = k / 8 * 2 * math.pi
        G.cyl('bar%d' % k, cage, (0.32 * math.cos(a), 0.32 * math.sin(a), 0.85), 0.025, 0.85, M['or_'], origin='top')
    G.cyl('cagetop', cage, (0, 0, 0.92), 0.38, 0.06, M['or_'], origin='top')
    G.cyl('cagebot', cage, (0, 0, 0.08), 0.38, 0.08, M['or_'], origin='top')
    G.sphere('cagedome', cage, (0, 0, 0.92), (0.38, 0.38, 0.22), M['or_'])
    # enseigne
    G.cyl('signpost', root, (-1.7, 0.8, 1.3), 0.04, 1.3, M['bois'], origin='top')
    G.box('sign', root, (-1.7, 0.8, 1.05), (0.55, 0.06, 0.3), M['bois_clair'])
    G.sphere('signhelm', root, (-1.7, 0.74, 1.05), (0.11, 0.06, 0.10), M['or_'])
    return root, 4.6, 0.7


def build_caserne(M):
    root = G.empty('caserne_root')
    # batiment trapu crenele
    G.box('main', root, (-0.7, 0, 0.55), (1.7, 1.5, 1.1), M['pierre'])
    G.box('tower', root, (-1.35, -0.6, 0.95), (0.7, 0.7, 1.9), M['pierre_clair'])
    crenellations('main', root, -0.7, 0, 1.18, 1.6, 1.4, M['pierre_clair'])
    crenellations('tower', root, -1.35, -0.6, 1.98, 0.62, 0.62, M['pierre'], n=3, s=0.12)
    G.box('door', root, (-0.7, -0.76, 0.35), (0.5, 0.06, 0.7), M['bois'])
    flag('twf', root, (-1.35, -0.6, 2.0), M['bois'], M['rouge'], h=0.8)
    # cour d'entrainement : palissade + mannequins
    for k, (x, y) in enumerate([(0.5, -0.9), (1.1, -0.9), (1.7, -0.9), (1.7, -0.3), (1.7, 0.3), (1.7, 0.9), (1.1, 0.9), (0.5, 0.9)]):
        G.cyl('pal%d' % k, root, (x, y, 0.5), 0.07, 0.5, M['bois_clair'], origin='top')
        bpy.context.active_object  # noqa
    for k, (x, y) in enumerate([(0.7, 0.25), (1.3, -0.35)]):
        G.cyl('dummy%d' % k, root, (x, y, 0.75), 0.06, 0.75, M['bois'], origin='top')
        G.sphere('dhead%d' % k, root, (x, y, 0.85), (0.12, 0.12, 0.14), M['toile_creme'])
        G.box('darms%d' % k, root, (x, y, 0.6), (0.6, 0.08, 0.08), M['bois_clair'])
    # ratelier d'armes
    G.box('rack', root, (0.45, -0.45, 0.5), (0.5, 0.08, 0.55), M['bois'])
    for k in range(3):
        G.box('sword%d' % k, root, (0.3 + k * 0.15, -0.48, 0.65), (0.04, 0.03, 0.6), M['fer'], rot=(0, 10 - k * 10, 0))
    return root, 4.4, 0.8


def build_taverne(M):
    root = G.empty('taverne_root')
    # rez-de-chaussee pierre + etage a colombages en encorbellement
    G.box('rdc', root, (0, 0, 0.45), (1.6, 1.3, 0.9), M['pierre'])
    G.box('etage', root, (0, 0, 1.25), (1.8, 1.5, 0.75), M['platre'])
    # colombages
    for k, x in enumerate((-0.8, -0.27, 0.27, 0.8)):
        G.box('beamv%d' % k, root, (x, -0.76, 1.25), (0.09, 0.04, 0.75), M['bois'])
    for k, z in enumerate((0.92, 1.6)):
        G.box('beamh%d' % k, root, (0, -0.76, z), (1.8, 0.05, 0.09), M['bois'])
    G.box('beamd1', root, (-0.53, -0.76, 1.25), (0.5, 0.035, 0.08), M['bois'], rot=(0, 38, 0))
    G.box('beamd2', root, (0.53, -0.76, 1.25), (0.5, 0.035, 0.08), M['bois'], rot=(0, -38, 0))
    gable_roof('roof', root, (0, 0, 1.78), 2.0, 1.7, 0.62, M['tuile'], M['bois'])
    # cheminee
    G.box('chim', root, (0.55, 0.3, 2.3), (0.22, 0.22, 0.5), M['pierre_clair'])
    # porte + fenetres eclairees
    G.box('door', root, (-0.3, -0.66, 0.4), (0.4, 0.06, 0.8), M['bois'])
    for k, (x, z) in enumerate([(0.45, 0.55), (-0.55, 1.3), (0.0, 1.3), (0.55, 1.3)]):
        G.box('win%d' % k, root, (x, -0.77, z), (0.22, 0.04, 0.3), M['lanterne'])
    # enseigne chope
    G.box('signarm', root, (-0.95, -0.7, 1.55), (0.5, 0.04, 0.05), M['bois'])
    G.cyl('mug', root, (-1.15, -0.7, 1.45), 0.12, 0.2, M['bois_clair'], origin='top')
    G.torus('mughandle', root, (-1.28, -0.7, 1.36), 0.07, 0.02, M['bois_clair'], rot=(90, 0, 0))
    # lanterne
    G.sphere('lant', root, (-0.62, -0.72, 0.85), (0.07, 0.07, 0.09), M['lanterne'])
    # tonneaux
    for k, (x, y) in enumerate([(1.05, -0.5), (1.05, -0.05), (0.92, -0.28)]):
        G.cyl('barrel%d' % k, root, (x, y, 0.24 if k < 2 else 0.62), 0.18, 0.42, M['bois_clair'], origin='center')
    return root, 4.3, 1.1


def build_banque(M):
    root = G.empty('banque_root')
    # perron a degres
    for k in range(3):
        G.box('step%d' % k, root, (0, -0.15 * k, 0.07 + k * 0.14), (2.0 - k * 0.15, 1.5 - k * 0.1, 0.14), M['pierre_clair'])
    # corps + colonnes + fronton
    G.box('cella', root, (0, 0.25, 1.0), (1.6, 1.0, 1.3), M['platre_blanc'])
    for k, x in enumerate((-0.75, -0.25, 0.25, 0.75)):
        G.cyl('col%d' % k, root, (x, -0.55, 1.65), 0.11, 1.3, M['platre_blanc'], origin='top')
        G.box('cap%d' % k, root, (x, -0.55, 1.68), (0.3, 0.3, 0.08), M['pierre_clair'])
        G.box('base%d' % k, root, (x, -0.55, 0.42), (0.28, 0.28, 0.1), M['pierre_clair'])
    G.box('architrave', root, (0, 0.0, 1.82), (2.0, 1.45, 0.18), M['platre_blanc'])
    gable_roof('fronton', root, (0, 0.0, 1.91), 2.05, 1.5, 0.45, M['tuile_bleue'], M['or_'])
    # piece d'or geante sur le fronton
    G.cyl('coin', root, (0, -0.78, 2.1), 0.22, 0.06, M['or_'], rot=(90, 0, 0), origin='center')
    # coffre + tas de pieces
    G.box('chest', root, (-0.85, -1.1, 0.32), (0.5, 0.35, 0.35), M['bois'])
    G.box('chestlid', root, (-0.85, -1.1, 0.5), (0.52, 0.37, 0.1), M['or_'])
    for k, (x, y) in enumerate([(0.8, -1.15), (0.95, -1.0), (0.7, -0.95), (0.85, -1.25)]):
        G.cyl('gc%d' % k, root, (x, y, 0.06 + (k % 2) * 0.05), 0.09, 0.04, M['or_'], origin='center')
    return root, 4.4, 1.0


def build_infirmerie(M):
    root = G.empty('infirmerie_root')
    G.box('main', root, (-0.5, 0, 0.65), (1.5, 1.3, 1.3), M['platre_blanc'])
    gable_roof('roof', root, (-0.5, 0, 1.32), 1.7, 1.5, 0.5, M['tuile_bleue'], M['blanc'])
    # croix de soin
    m_croix = G.mat('croix_rouge', (0.75, 0.10, 0.08), rough=0.6)
    G.box('crv', root, (-0.5, -0.67, 1.0), (0.14, 0.05, 0.45), m_croix)
    G.box('crh', root, (-0.5, -0.67, 1.0), (0.45, 0.05, 0.14), m_croix)
    G.box('door', root, (-0.5, -0.66, 0.35), (0.4, 0.06, 0.7), M['bois_clair'])
    # baton d'Asclepios stylise
    G.cyl('asc', root, (-1.15, -0.55, 1.5), 0.035, 0.9, M['bois'], origin='top')
    G.torus('snake1', root, (-1.15, -0.55, 1.0), 0.10, 0.028, M['feuillage_olive'], rot=(0, 18, 0))
    G.torus('snake2', root, (-1.15, -0.55, 1.22), 0.10, 0.028, M['feuillage_olive'], rot=(0, -18, 0))
    # tentes de convalescence
    for k, (x, y, r) in enumerate([(0.85, -0.4, 0.55), (0.95, 0.55, 0.45)]):
        G.cone('tent%d' % k, root, (x, y, r * 0.55), r, 0.0, r * 1.1, M['toile_creme'], verts=10)
        G.cyl('tentpole%d' % k, root, (x, y, r * 1.2), 0.02, 0.15, M['bois'], origin='top')
        G.box('tentflag%d' % k, root, (x + 0.08, y, r * 1.16), (0.16, 0.02, 0.1), m_croix)
    # civiere
    G.box('stretcher', root, (0.2, -0.85, 0.18), (0.7, 0.3, 0.05), M['toile_creme'])
    return root, 4.2, 0.8


def build_fontaine(M):
    root = G.empty('fontaine_root')
    G.cyl('basin', root, (0, 0, 0.18), 0.85, 0.36, M['pierre_clair'], origin='center')
    G.cyl('water', root, (0, 0, 0.30), 0.75, 0.08, M['eau'], origin='center')
    G.cyl('column', root, (0, 0, 0.85), 0.12, 1.0, M['pierre'], origin='center')
    G.cyl('cup', root, (0, 0, 1.35), 0.35, 0.10, M['pierre_clair'], origin='center')
    G.cyl('water2', root, (0, 0, 1.4), 0.3, 0.05, M['eau'], origin='center')
    G.sphere('top', root, (0, 0, 1.55), (0.12, 0.12, 0.16), M['or_'])
    return root, 2.6, 0.7


def build_arbre(M, conifere=True):
    root = G.empty('arbre_root')
    if conifere:  # cypres
        G.cyl('trunk', root, (0, 0, 0.3), 0.08, 0.5, M['bois_clair'], origin='center')
        for k, (r, z, h) in enumerate([(0.42, 0.8, 0.9), (0.34, 1.4, 0.75), (0.24, 1.9, 0.6)]):
            G.cone('fol%d' % k, root, (0, 0, z), r, 0.02, h, M['feuillage'], verts=12)
    else:  # olivier
        G.cyl('trunk', root, (0, 0, 0.4), 0.1, 0.8, M['bois_clair'], origin='center', rot=(0, 8, 0))
        G.sphere('f1', root, (0.15, 0.05, 1.0), (0.5, 0.45, 0.35), M['feuillage_olive'])
        G.sphere('f2', root, (-0.3, -0.1, 0.85), (0.35, 0.3, 0.28), M['feuillage_olive'])
        G.sphere('f3', root, (0.05, 0.25, 1.2), (0.3, 0.28, 0.22), M['feuillage_olive'])
    return root, 2.6, 0.9


def build_statue(M):
    root = G.empty('statue_root')
    G.box('socle1', root, (0, 0, 0.15), (1.0, 1.0, 0.3), M['pierre'])
    G.box('socle2', root, (0, 0, 0.4), (0.75, 0.75, 0.25), M['pierre_clair'])
    rig = G.build_character('bretteur', 0, prefix='statue_')
    rig['root'].parent = root
    rig['root'].location = (0, 0, 0.52)
    G.apply_pose(rig, G.get_pose('bretteur', 'attack', 0), direction_deg=0)
    rig['root'].location = (0, 0, 0.52)
    # tout en pierre
    m_st = G.mat('pierre_statue', (0.62, 0.60, 0.55), rough=0.9)
    for ob in bpy.data.objects:
        if ob.name.startswith('statue_') and ob.type == 'MESH':
            ob.data.materials.clear()
            ob.data.materials.append(m_st)
    return root, 3.4, 1.1
