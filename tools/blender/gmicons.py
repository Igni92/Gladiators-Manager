# -*- coding: utf-8 -*-
"""Icônes 3D du jeu : pièces, stats, talents — petits objets rendus sur alpha."""
import math
from math import radians

import bpy
import gmlib as G


def _font(body, mat_, size=1.0, extrude=0.12, loc=(0, 0, 0)):
    cu = bpy.data.curves.new('txt', type='FONT')
    cu.body = body
    cu.extrude = extrude
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    ob = bpy.data.objects.new('txt', cu)
    bpy.context.collection.objects.link(ob)
    ob.scale = (size, size, size)
    ob.location = loc
    ob.rotation_euler = (radians(90), 0, 0)
    ob.data.materials.append(mat_)
    return ob


def M():
    return dict(
        or_=G.mat('ic_or', (1.0, 0.72, 0.18), metallic=1.0, rough=0.25),
        or_fonce=G.mat('ic_or2', (0.72, 0.48, 0.10), metallic=1.0, rough=0.35),
        acier=G.mat('ic_acier', (0.55, 0.58, 0.64), metallic=0.9, rough=0.3),
        fer=G.mat('ic_fer', (0.30, 0.32, 0.36), metallic=0.9, rough=0.45),
        rouge=G.mat('ic_rouge', (0.78, 0.10, 0.08), rough=0.4),
        rouge_fonce=G.mat('ic_rouge2', (0.45, 0.04, 0.04), rough=0.5),
        cuir=G.mat('ic_cuir', (0.35, 0.20, 0.10), rough=0.7, bump=0.1),
        bois=G.mat('ic_bois', (0.30, 0.18, 0.08), rough=0.7, bump=0.12),
        blanc=G.mat('ic_blanc', (0.92, 0.90, 0.86), rough=0.6),
        creme=G.mat('ic_creme', (0.90, 0.84, 0.70), rough=0.7),
        vert=G.mat('ic_vert', (0.15, 0.45, 0.20), rough=0.5),
        vert_sombre=G.mat('ic_vert2', (0.10, 0.22, 0.12), rough=0.5),
        cyan=G.mat('ic_cyan', (0.25, 0.75, 0.85), rough=0.4),
        violet=G.mat('ic_violet', (0.45, 0.20, 0.75), rough=0.4),
        violet_em=G.mat('ic_violet_em', (0.5, 0.2, 1.0), emit=(0.55, 0.25, 1.0), emit_strength=4.0),
        jaune_em=G.mat('ic_jaune_em', (1.0, 0.8, 0.2), emit=(1.0, 0.75, 0.15), emit_strength=3.0),
        orange_em=G.mat('ic_orange_em', (1.0, 0.45, 0.1), emit=(1.0, 0.4, 0.08), emit_strength=2.5),
        gris=G.mat('ic_gris', (0.55, 0.55, 0.58), rough=0.85),
        gris_clair=G.mat('ic_gris2', (0.75, 0.75, 0.78), rough=0.9),
        noir=G.mat('ic_noir', (0.05, 0.05, 0.06), rough=0.5),
        parchemin=G.mat('ic_parch', (0.88, 0.78, 0.55), rough=0.8),
    )


def piece(m, loc=(0, 0, 0), rot=(90, 0, 0), r=0.85):
    """Pièce d'or frappée d'un glaive."""
    c = G.cyl('coin', None, loc, r, 0.16, m['or_'], rot=rot, verts=36, origin='center')
    G.torus('rim', c, (0, 0, 0.09), r * 0.92, 0.05, m['or_fonce'])
    G.torus('rim2', c, (0, 0, -0.09), r * 0.92, 0.05, m['or_fonce'])
    # glaive embossé
    G.box('lame', c, (0, 0.05, 0.10), (0.16, 0.75, 0.05), m['or_fonce'], bevel=0.02)
    G.box('garde', c, (0, -0.22, 0.10), (0.45, 0.10, 0.05), m['or_fonce'], bevel=0.02)
    return c


def b_po(m):
    piece(m, loc=(0.18, 0.3, 0.62), rot=(80, 0, 18))
    piece(m, loc=(-0.35, -0.1, 0.16), rot=(8, 0, -20))
    piece(m, loc=(0.42, -0.25, 0.16), rot=(4, 0, 35))


def b_bourse(m):
    G.sphere('sac', None, (0, 0, 0.55), (0.72, 0.62, 0.62), m['cuir'])
    G.cyl('cou', None, (0, 0, 1.18), 0.18, 0.25, m['cuir'], origin='center')
    G.torus('lien', None, (0, 0, 1.12), 0.20, 0.05, m['or_fonce'])
    G.sphere('haut', None, (0, 0, 1.32), (0.16, 0.16, 0.12), m['cuir'])
    piece(m, loc=(0.62, -0.42, 0.14), rot=(6, 0, 25), r=0.5)


def b_reputation(m):
    # couronne de laurier
    for side in (-1, 1):
        for i in range(6):
            a = radians(20 + i * 26)
            x = side * math.sin(a) * 0.78
            z = 0.55 + math.cos(a) * 0.7
            G.sphere('f%d%d' % (side, i), None, (x, 0, z), (0.16, 0.07, 0.26), m['vert'],
                     rot=(0, side * (15 + i * 12), 0))
    G.sphere('base', None, (0, 0, -0.12), (0.2, 0.1, 0.12), m['or_'])
    G.sphere('etoile', None, (0, 0, 0.62), (0.16, 0.16, 0.16), m['jaune_em'])


def b_moral(m):
    # coeur
    G.sphere('g', None, (-0.3, 0, 0.75), (0.42, 0.35, 0.42), m['rouge'])
    G.sphere('d', None, (0.3, 0, 0.75), (0.42, 0.35, 0.42), m['rouge'])
    G.cone('pointe', None, (0, 0, 0.18), 0.62, 0.0, 0.95, m['rouge'], rot=(180, 0, 0), verts=4)


def b_forme(m):
    G.cone('fl1', None, (0, 0, 0.55), 0.5, 0.04, 1.15, m['orange_em'], verts=12)
    G.cone('fl2', None, (0.22, 0, 0.35), 0.26, 0.02, 0.7, m['jaune_em'], verts=10, rot=(0, 12, 0))
    G.cone('fl3', None, (-0.2, 0, 0.3), 0.2, 0.02, 0.55, m['jaune_em'], verts=10, rot=(0, -14, 0))


def b_fatigue(m):
    G.box('oreiller', None, (0, 0, 0.3), (1.5, 1.0, 0.45), m['blanc'], bevel=0.16)
    for sx in (-0.7, 0.7):
        for sy in (-0.45, 0.45):
            G.sphere('c%s%s' % (sx, sy), None, (sx, sy, 0.3), (0.12, 0.12, 0.18), m['creme'])
    _font('z', m['cyan'], size=0.55, loc=(0.45, -0.2, 0.95))
    _font('Z', m['cyan'], size=0.75, loc=(-0.25, -0.2, 1.15))


def b_blessure(m):
    G.cyl('rouleau', None, (0, 0, 0.5), 0.55, 0.85, m['blanc'], rot=(0, 90, 0), origin='center')
    G.cyl('coeur', None, (0, 0, 0.5), 0.2, 0.95, m['creme'], rot=(0, 90, 0), origin='center')
    G.box('cr1', None, (0.02, -0.58, 0.5), (0.14, 0.05, 0.5), m['rouge'])
    G.box('cr2', None, (0.02, -0.58, 0.5), (0.5, 0.05, 0.14), m['rouge'])


def b_force(m):
    G.cyl('barre', None, (0, 0, 0.55), 0.09, 1.7, m['fer'], rot=(0, 90, 0), origin='center')
    for sx in (-0.72, 0.72):
        G.cyl('p1%s' % sx, None, (sx, 0, 0.55), 0.42, 0.22, m['fer'], rot=(0, 90, 0), origin='center')
        G.cyl('p2%s' % sx, None, (sx * 1.28, 0, 0.55), 0.3, 0.18, m['acier'], rot=(0, 90, 0), origin='center')


def b_vitesse(m):
    # éclair en boîtes
    G.box('e1', None, (0.12, 0, 1.0), (0.42, 0.16, 0.65), m['jaune_em'], rot=(0, 18, 0))
    G.box('e2', None, (-0.12, 0, 0.45), (0.42, 0.16, 0.65), m['jaune_em'], rot=(0, -22, 0))
    G.cone('pointe', None, (0.05, 0, -0.12), 0.26, 0.0, 0.5, m['jaune_em'], rot=(180, -12, 0), verts=4)


def b_intelligence(m):
    G.cyl('rouleau', None, (0, 0, 0.45), 0.4, 1.5, m['parchemin'], rot=(0, 90, 0), origin='center')
    for sx in (-0.78, 0.78):
        G.cyl('bout%s' % sx, None, (sx, 0, 0.45), 0.16, 0.3, m['bois'], rot=(0, 90, 0), origin='center')
    G.torus('ruban', None, (0, 0, 0.45), 0.43, 0.06, m['rouge'], rot=(0, 90, 0))


def b_fourberie(m):
    g = G.empty('dague')
    g.rotation_euler = (0, radians(35), 0)
    G.cyl('manche', g, (0, 0, -0.5), 0.11, 0.5, m['vert_sombre'], origin='top')
    G.box('garde', g, (0, 0, 0.05), (0.6, 0.12, 0.1), m['or_fonce'], bevel=0.02)
    G.box('lame', g, (0, 0, 0.6), (0.22, 0.07, 1.0), m['acier'], bevel=0.02)
    G.cone('pointe', g, (0, 0, 1.25), 0.15, 0.0, 0.35, m['acier'], verts=4)
    g.location = (0, 0, 0.55)


def b_esquive(m):
    # plume
    p = G.empty('plume')
    p.rotation_euler = (0, radians(-30), 0)
    G.sphere('barbe', p, (0, 0, 0.4), (0.30, 0.06, 0.85), m['cyan'])
    G.cyl('tige', p, (0, 0, -0.6), 0.04, 0.7, m['blanc'], origin='top')
    p.location = (0, 0, 0.6)
    # traits de mouvement
    for i, dz in enumerate((-0.1, 0.15, 0.4)):
        G.box('tr%d' % i, None, (-0.85, 0, 0.45 + dz), (0.4 - i * 0.08, 0.04, 0.05), m['gris_clair'])


def b_magie(m):
    G.cyl('socle', None, (0, 0, 0.1), 0.4, 0.2, m['or_fonce'], origin='center')
    G.sphere('orbe', None, (0, 0, 0.75), (0.55, 0.55, 0.55), m['violet_em'])
    G.torus('anneau', None, (0, 0, 0.75), 0.7, 0.04, m['or_'], rot=(70, 0, 20))


def b_entrainement(m):
    G.cyl('cible', None, (0, 0, 0.75), 0.8, 0.14, m['creme'], rot=(90, 0, 0), origin='center')
    G.cyl('c2', None, (0, -0.08, 0.75), 0.55, 0.1, m['rouge'], rot=(90, 0, 0), origin='center')
    G.cyl('c3', None, (0, -0.15, 0.75), 0.3, 0.1, m['blanc'], rot=(90, 0, 0), origin='center')
    G.cyl('fleche', None, (0.3, -0.7, 1.1), 0.05, 0.9, m['bois'], rot=(55, 25, 0), origin='top')
    G.cone('pte', None, (0.06, -0.2, 0.82), 0.09, 0.0, 0.3, m['fer'], rot=(55, 25, 0))


def b_aide(m):
    _font('?', m['or_'], size=2.2, extrude=0.18, loc=(0, 0, 0.75))


def b_talent(m):
    G.sphere('etoile', None, (0, 0, 0.7), (0.4, 0.4, 0.4), m['jaune_em'])
    for i in range(6):
        a = i * math.pi / 3
        G.cone('br%d' % i, None, (math.cos(a) * 0.62, 0, 0.7 + math.sin(a) * 0.62),
               0.14, 0.0, 0.5, m['or_'], rot=(0, math.degrees(a) + 90, 0), verts=4)
    _font('?', m['noir'], size=0.8, extrude=0.2, loc=(0, -0.42, 0.7))


# ---------- talents ----------

def b_t_fumigene(m):
    G.sphere('bombe', None, (0.3, 0.2, 0.35), (0.35, 0.35, 0.35), m['noir'])
    G.cyl('meche', None, (0.42, 0.2, 0.78), 0.04, 0.25, m['cuir'], rot=(15, 20, 0), origin='center')
    G.sphere('etincelle', None, (0.5, 0.18, 0.95), (0.08, 0.08, 0.08), m['jaune_em'])
    for i, (x, z, r) in enumerate([(-0.4, 0.5, 0.42), (-0.05, 0.85, 0.35), (-0.6, 0.95, 0.28), (-0.25, 1.2, 0.22)]):
        G.sphere('fum%d' % i, None, (x, 0.1, z), (r, r * 0.9, r * 0.8), m['gris_clair'])


def b_t_dash(m):
    for i in range(3):
        x = -0.55 + i * 0.55
        G.box('ch%dA' % i, None, (x, 0, 0.85), (0.14, 0.1, 0.55), m['cyan'], rot=(0, 38, 0))
        G.box('ch%dB' % i, None, (x, 0, 0.32), (0.14, 0.1, 0.55), m['cyan'], rot=(0, -38, 0))


def b_t_riposte(m):
    G.cyl('bouclier', None, (-0.15, 0, 0.6), 0.65, 0.12, m['rouge_fonce'], rot=(90, 0, 0), verts=28, origin='center')
    G.sphere('umbo', None, (-0.15, -0.1, 0.6), (0.18, 0.1, 0.18), m['or_'])
    ep = G.empty('epee')
    ep.rotation_euler = (0, radians(45), 0)
    ep.location = (0.25, -0.25, 0.45)
    G.box('lame', ep, (0, 0, 0.5), (0.13, 0.06, 0.8), m['acier'], bevel=0.02)
    G.cone('pte', ep, (0, 0, 1.0), 0.09, 0.0, 0.22, m['acier'], verts=4)
    G.box('garde', ep, (0, 0, 0.05), (0.4, 0.08, 0.08), m['or_'])
    G.cyl('manche', ep, (0, 0, -0.28), 0.07, 0.3, m['cuir'], origin='top')


def b_t_rage(m):
    G.cone('fl', None, (0, 0, 0.55), 0.55, 0.04, 1.2, m['rouge'], verts=12)
    G.cone('fl2', None, (0.18, 0, 0.4), 0.28, 0.02, 0.75, m['orange_em'], verts=10, rot=(0, 10, 0))
    G.cone('fl3', None, (-0.18, 0, 0.35), 0.22, 0.02, 0.6, m['orange_em'], verts=10, rot=(0, -12, 0))


def b_t_carapace(m):
    G.sphere('dome', None, (0, 0, 0.35), (0.85, 0.7, 0.55), m['acier'])
    for i in range(5):
        a = radians(i * 72 + 20)
        G.sphere('riv%d' % i, None, (math.cos(a) * 0.55, math.sin(a) * 0.42, 0.62), (0.09, 0.09, 0.09), m['or_fonce'])
    G.torus('bord', None, (0, 0, 0.12), 0.78, 0.08, m['fer'])


def b_t_vampirisme(m):
    G.sphere('goutte', None, (0, 0, 0.55), (0.45, 0.4, 0.55), m['rouge'])
    G.cone('haut', None, (0, 0, 1.18), 0.26, 0.0, 0.55, m['rouge'], verts=12)
    G.cone('croc1', None, (-0.5, -0.2, 1.0), 0.14, 0.0, 0.5, m['blanc'], rot=(180, -10, 0))
    G.cone('croc2', None, (0.55, -0.2, 1.05), 0.11, 0.0, 0.4, m['blanc'], rot=(180, 10, 0))


def b_t_executeur(m):
    G.cyl('manche', None, (0.1, 0, 0.7), 0.07, 1.6, m['bois'], rot=(0, 18, 0), origin='center')
    G.box('lame', None, (-0.4, 0, 1.15), (0.6, 0.07, 0.7), m['fer'], rot=(0, 18, 0), bevel=0.03)
    G.box('tranchant', None, (-0.68, 0, 1.12), (0.1, 0.075, 0.66), m['acier'], rot=(0, 18, 0))


def b_t_premiersang(m):
    G.sphere('goutte', None, (-0.3, 0, 0.6), (0.35, 0.3, 0.42), m['rouge'])
    G.cone('haut', None, (-0.3, 0, 1.06), 0.2, 0.0, 0.42, m['rouge'], verts=12)
    G.sphere('eclat', None, (0.45, 0, 0.9), (0.22, 0.22, 0.22), m['jaune_em'])
    for i in range(4):
        a = i * math.pi / 2 + 0.4
        G.cone('ray%d' % i, None, (0.45 + math.cos(a) * 0.38, 0, 0.9 + math.sin(a) * 0.38),
               0.08, 0.0, 0.3, m['or_'], rot=(0, math.degrees(a) + 90, 0), verts=4)


def b_t_longueportee(m):
    j = G.empty('javelot')
    j.rotation_euler = (0, radians(58), 0)
    j.location = (-0.2, 0, 0.55)
    G.cyl('bois', j, (0, 0, 0.9), 0.045, 1.8, m['bois'], origin='top')
    G.cone('pte', j, (0, 0, 1.05), 0.1, 0.0, 0.35, m['acier'], verts=8)
    for i, r in enumerate((0.25, 0.45, 0.65)):
        G.torus('cercle%d' % i, None, (0.75, 0, 0.85), r, 0.035, m['cyan'], rot=(90, 0, 0))


def b_t_secondevie(m):
    G.sphere('g', None, (-0.22, 0, 0.7), (0.32, 0.26, 0.32), m['or_'])
    G.sphere('d', None, (0.22, 0, 0.7), (0.32, 0.26, 0.32), m['or_'])
    G.cone('pointe', None, (0, 0, 0.28), 0.48, 0.0, 0.7, m['or_'], rot=(180, 0, 0), verts=4)
    # aile
    for i, (dx, dz, l) in enumerate([(0.55, 0.95, 0.55), (0.72, 0.8, 0.45), (0.85, 0.65, 0.35)]):
        G.sphere('ail%d' % i, None, (dx, 0, dz), (l, 0.05, 0.14), m['blanc'], rot=(0, -28 - i * 14, 0))


ICONES = {
    'po': b_po, 'bourse': b_bourse, 'reputation': b_reputation, 'moral': b_moral,
    'forme': b_forme, 'fatigue': b_fatigue, 'blessure': b_blessure, 'force': b_force,
    'vitesse': b_vitesse, 'intelligence': b_intelligence, 'fourberie': b_fourberie,
    'esquive': b_esquive, 'magie': b_magie, 'entrainement': b_entrainement,
    'aide': b_aide, 'talent': b_talent,
    'fumigene': b_t_fumigene, 'dash': b_t_dash, 'riposte': b_t_riposte,
    'rage': b_t_rage, 'carapace': b_t_carapace, 'vampirisme': b_t_vampirisme,
    'executeur': b_t_executeur, 'premiersang': b_t_premiersang,
    'longueportee': b_t_longueportee, 'secondevie': b_t_secondevie,
}
