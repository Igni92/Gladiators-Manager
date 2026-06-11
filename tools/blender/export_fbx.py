# -*- coding: utf-8 -*-
"""Export des assets 3D « moteur de jeu » : FBX riggés (armature réelle générée
depuis la hiérarchie d'empties), 3 LOD, textures PBR (albedo bake + normal/
roughness/metallic). Sortie : assets3d/fbx/, assets3d/textures/.

  /opt/blender/blender -b -P export_fbx.py            # tout le catalogue
  /opt/blender/blender -b -P export_fbx.py -- tete_elfe_f corps_orc_2

Catalogue : tete_{race}_{genre} (12) · corps_{race}_{corp} (18) ·
armure_{classe} (6) · armes_{classe} (6) = 42 assets × 3 LOD.
"""
import os
import re
import sys
import time

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gmlib as G  # noqa: E402

A3D = '/home/user/Gladiators-Manager/assets3d'
FBX = os.path.join(A3D, 'fbx')
TEX = os.path.join(A3D, 'textures')
os.makedirs(FBX, exist_ok=True)
os.makedirs(TEX, exist_ok=True)

# pièces « tête » (sans le casque, qui appartient à l'armure de classe)
RE_TETE = re.compile(r'_(head|eye|iris|pupil|glint|brow|smile|jaw|tooth|hair|beard|mous|braid|fringe|ear|horn|tusk|snout|nostril|lash|nose|tail|bust)')
# pièces d'armure/coiffe de classe
RE_ARMURE = re.compile(r'_(helm|crest|cheek|slit|fin|brim|hood|mask|bandana|scarf|plume|crown|hat|circlet|band(?!ana)|chest|belly|pad|skirt|robe|rune|belt|buckle|bracer|uarm|farm|thigh|shin|foot|paint|wrap|ring|btie|mohawk)')
# armes et boucliers
RE_ARME = re.compile(r'_(hilt|guard|blade|tip|shield|boss|haft|macehead|spike|dhilt|dguard|dblade|dtip|spear|spearhead|staff|crystal|orb|ahaft|aneck|ablade|aback)')
# le corps nu = peau
RE_CORPS = re.compile(r'_(hand|paint)')  # mains ; le reste de la peau est couvert par tête/armure

LODS = [(0, 1.0), (1, 0.45), (2, 0.18)]

LIM_TRIS = {0: 20000, 1: 8000, 2: 3000}


def classifier(nom):
    if RE_ARME.search(nom):
        return 'armes'
    if RE_TETE.search(nom):
        return 'tete'
    if RE_ARMURE.search(nom):
        return 'armure'
    return 'corps'


def joint_de(obj, rig):
    """Premier empty d'articulation en remontant les parents."""
    p = obj.parent
    noms = {rig[j]: j for j in G.JOINTS if j in rig}
    while p is not None:
        if p in noms:
            return noms[p]
        p = p.parent
    return 'pelvis'


def creer_armature(rig):
    """Armature réelle reflétant la hiérarchie d'empties du personnage."""
    arm_data = bpy.data.armatures.new('Squelette')
    arm = bpy.data.objects.new('Squelette', arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    parents = {
        'pelvis': None, 'spine': 'pelvis', 'neck': 'spine',
        'shoulder_L': 'spine', 'shoulder_R': 'spine',
        'elbow_L': 'shoulder_L', 'elbow_R': 'shoulder_R',
        'grip_L': 'elbow_L', 'grip_R': 'elbow_R',
        'hip_L': 'pelvis', 'hip_R': 'pelvis',
        'knee_L': 'hip_L', 'knee_R': 'hip_R',
    }
    bpy.context.view_layer.update()
    bones = {}
    for j in G.JOINTS:
        if j not in rig:
            continue
        b = arm_data.edit_bones.new(j)
        tete = rig[j].matrix_world.translation
        enfants = [rig[c] for c, p in parents.items() if p == j and c in rig]
        if enfants:
            queue = sum((rig_obj.matrix_world.translation for rig_obj in enfants), Vector()) / len(enfants)
            if (queue - tete).length < 0.03:
                queue = tete + Vector((0, 0, 0.08))
        else:
            queue = tete + Vector((0, 0, -0.1 if 'knee' in j or 'grip' in j else 0.08))
        b.head = tete
        b.tail = queue
        bones[j] = b
    for j, p in parents.items():
        if p and j in bones and p in bones:
            bones[j].parent = bones[p]
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def preparer_meshes(rig, garder):
    """Ne garde que les meshes de la catégorie, skinnés rigides sur l'armature."""
    prefixe = rig['root'].name.replace('_root', '')
    meshes = []
    for ob in list(bpy.data.objects):
        if ob.type != 'MESH' or not ob.name.startswith(prefixe):
            continue
        if ob.hide_render:
            bpy.data.objects.remove(ob)
            continue
        if classifier(ob.name) != garder:
            bpy.data.objects.remove(ob)
        else:
            meshes.append(ob)
    return meshes


def skinner(meshes, rig, arm):
    for ob in meshes:
        j = joint_de(ob, rig)
        # applique la transformation monde puis parente à l'armature
        mw = ob.matrix_world.copy()
        ob.parent = arm
        ob.matrix_world = mw
        vg = ob.vertex_groups.new(name=j)
        vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
        mod = ob.modifiers.new('Armature', 'ARMATURE')
        mod.object = arm


def compter_tris():
    deps = bpy.context.evaluated_depsgraph_get()
    total = 0
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            me = ob.evaluated_get(deps).to_mesh()
            me.calc_loop_triangles()
            total += len(me.loop_triangles)
    return total


def bake_albedo(meshes, nom):
    """Smart UV + bake DIFFUSE (couleur seule) sur une texture 512 partagée."""
    img = bpy.data.images.new(nom, 512, 512, alpha=False)
    for ob in meshes:
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
        bpy.ops.object.mode_set(mode='OBJECT')
        for slot in ob.material_slots:
            m = slot.material
            if not m or not m.use_nodes:
                continue
            nt = m.node_tree
            node = nt.nodes.new('ShaderNodeTexImage')
            node.image = img
            nt.nodes.active = node
        ob.select_set(False)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 8
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    try:
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=4)
        img.filepath_raw = os.path.join(TEX, nom + '_albedo.png')
        img.file_format = 'PNG'
        img.save()
        return True
    except RuntimeError as e:
        print('  bake impossible (%s)' % e)
        return False


def textures_plates(nom, meshes):
    """Normal neutre + roughness/metallic moyens depuis les matériaux (PIL côté python système)."""
    rough = met = n = 0
    for ob in meshes:
        for slot in ob.material_slots:
            m = slot.material
            if m and m.use_nodes and 'Principled BSDF' in m.node_tree.nodes:
                b = m.node_tree.nodes['Principled BSDF']
                rough += b.inputs['Roughness'].default_value
                met += b.inputs['Metallic'].default_value
                n += 1
    rough = rough / n if n else 0.6
    met = met / n if n else 0.0
    with open(os.path.join(TEX, nom + '_pbr.txt'), 'w') as f:
        f.write('roughness=%.3f\nmetallic=%.3f\n' % (rough, met))


def exporter(nom, builder):
    for lod, ratio in LODS:
        G.reset_scene()
        rig, garder = builder()
        G.apply_pose(rig, {}, direction_deg=0)  # pose de repos
        arm = creer_armature(rig)
        meshes = preparer_meshes(rig, garder)
        if not meshes:
            print('  %s : aucune pièce, saut' % nom)
            return
        skinner(meshes, rig, arm)
        # supprime les empties (la hiérarchie vit dans l'armature)
        for ob in list(bpy.data.objects):
            if ob.type == 'EMPTY':
                bpy.data.objects.remove(ob)
        if ratio < 1.0:
            for ob in meshes:
                d = ob.modifiers.new('lod', 'DECIMATE')
                d.ratio = ratio
        tris = compter_tris()
        if lod == 0:
            bake_albedo(meshes, nom)
            textures_plates(nom, meshes)
        dest = os.path.join(FBX, '%s_lod%d.fbx' % (nom, lod))
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.fbx(
            filepath=dest, use_selection=True, add_leaf_bones=False,
            apply_scale_options='FBX_SCALE_ALL', path_mode='STRIP',
        )
        print('  %s_lod%d.fbx : %d tris (limite %d)' % (nom, lod, tris, LIM_TRIS[lod]), flush=True)


def catalogue():
    jobs = []
    for race in G.RACE_LIST:
        for genre in ('m', 'f'):
            jobs.append(('tete_%s_%s' % (race, genre),
                         lambda r=race, g=genre: (G.build_character('bretteur', race=r, genre=g), 'tete')))
    for race in G.RACE_LIST:
        for corp in (0, 1, 2):
            jobs.append(('corps_%s_%d' % (race, corp),
                         lambda r=race, c=corp: (G.build_character('berserker', race=r, genre='m', corpulence=c), 'corps')))
    for cls in G.CLASSES.keys():
        jobs.append(('armure_%s' % cls, lambda c=cls: (G.build_character(c, race='humain'), 'armure')))
        jobs.append(('armes_%s' % cls, lambda c=cls: (G.build_character(c, race='humain'), 'armes')))
    return jobs


args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
t0 = time.time()
for nom, builder in catalogue():
    if args and nom not in args:
        continue
    dest0 = os.path.join(FBX, nom + '_lod0.fbx')
    if os.path.exists(dest0) and not args:
        print('%s : déjà exporté, saut' % nom, flush=True)
        continue
    print('ASSET %s…' % nom, flush=True)
    exporter(nom, builder)
print('EXPORT 3D TERMINE en %.0fs' % (time.time() - t0))
