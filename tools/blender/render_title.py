# Ecran titre (composition heroique 3 personnages) + icone d'app (casque).
# /opt/blender/blender -b -P render_title.py
import sys, os, math, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gmlib as G
import gmtown as T
import bpy
from math import radians

DEST = G.ASSETS + '/ui'
os.makedirs(DEST, exist_ok=True)
t0 = time.time()

# ----------------------------------------------------------- ecran titre ----
G.reset_scene()
sc = G.setup_render(res_x=1024, res_y=1024, samples=48, transparent=False)
# ciel couchant
bg = sc.world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.45, 0.16, 0.08, 1.0)
bg.inputs[1].default_value = 1.0
M = T.mats()

# sol de sable
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=8.0, depth=0.1, location=(0, 0, -0.05))
sand = bpy.context.active_object
sand.data.materials.append(M['sable'])

# mur d'arene en arriere-plan + oriflammes
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=5.5, depth=2.6, location=(0, 8.0, 1.3))
wall = bpy.context.active_object
wall.data.materials.append(M['pierre'])
for a_deg in (215, 250, 290, 325):
    a = radians(a_deg)
    T.flag('f%d' % a_deg, None, (5.5 * math.cos(a), 8.0 + 5.5 * math.sin(a), 2.6), M['bois'], M['rouge'], h=1.2)
for a_deg in (230, 310):
    a = radians(a_deg)
    T.torch('t%d' % a_deg, None, (5.2 * math.cos(a), 8.0 + 5.2 * math.sin(a), 1.3), M, h=1.0)

# bretteur au centre, pose victorieuse (epee levee)
b = G.build_character('bretteur', race='humain', genre='m', prefix='hero_')
G.apply_pose(b, G.get_pose('bretteur', 'attack', 0), direction_deg=0)
b['root'].location = (0, -1.2, 0)
# colosse derriere a gauche
c = G.build_character('colosse', race='orc', genre='m', corpulence=2, prefix='tank_')
G.apply_pose(c, G.get_pose('colosse', 'idle', 0), direction_deg=15)
c['root'].location = (-1.95, 0.75, 0)
# mage derriere a droite, orbe levee
m = G.build_character('mage', race='elfe', genre='f', prefix='mage_')
G.apply_pose(m, G.get_pose('mage', 'cast', 3), direction_deg=-12)
for mat_ in __import__('bpy').data.materials:
    if mat_.name == 'orb':
        mat_.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 2.5
m['root'].location = (1.95, 0.7, 0)

# camera perspective legerement basse
cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 50
cam = bpy.data.objects.new('cam', cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (0, -6.3, 1.45)
cam.rotation_euler = (radians(84), 0, 0)
sc.camera = cam

def sun(name, energy, color, rot, angle=0.2):
    ld = bpy.data.lights.new(name, 'SUN')
    ld.energy = energy
    ld.color = color
    ld.angle = angle
    lo = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(lo)
    lo.rotation_euler = [radians(a) for a in rot]

sun('key', 2.4, (1.0, 0.72, 0.45), (62, 0, -38), 0.3)   # soleil couchant
sun('fill', 0.5, (0.45, 0.5, 0.9), (70, 0, 45), 1.2)
sun('rim', 4.0, (1.0, 0.42, 0.15), (-55, 0, 10), 0.4)

G.render_to(DEST + '/title_hero.png')
print('TITLE OK (%.0fs)' % (time.time() - t0))

# ----------------------------------------------------------------- icone ----
G.reset_scene()
sc = G.setup_render(res_x=1024, res_y=1024, samples=48, transparent=False)
bg = sc.world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.045, 0.03, 0.025, 1.0)
bg.inputs[1].default_value = 1.0

# fond degrade radial sombre : grand plan emissif derriere le casque
m_bg = bpy.data.materials.new('icon_bg')
m_bg.use_nodes = True
nt = m_bg.node_tree
nt.nodes.remove(nt.nodes['Principled BSDF'])
em = nt.nodes.new('ShaderNodeEmission')
grad = nt.nodes.new('ShaderNodeTexGradient')
grad.gradient_type = 'SPHERICAL'
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (0.02, 0.012, 0.01, 1)
ramp.color_ramp.elements[1].color = (0.38, 0.14, 0.05, 1)
mapping = nt.nodes.new('ShaderNodeMapping')
coord = nt.nodes.new('ShaderNodeTexCoord')
nt.links.new(coord.outputs['Object'], mapping.inputs['Vector'])
nt.links.new(mapping.outputs['Vector'], grad.inputs['Vector'])
nt.links.new(grad.outputs['Fac'], ramp.inputs['Fac'])
# inverser : centre clair
ramp.color_ramp.elements[0].position = 1.0
ramp.color_ramp.elements[1].position = 0.0
nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
em.inputs['Strength'].default_value = 1.0
out = nt.nodes['Material Output']
nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 4.0, 1.45), rotation=(radians(90), 0, 0))
plane = bpy.context.active_object
plane.data.materials.append(m_bg)
plane.scale = (1, 1, 1)

# le bretteur (on cadre la tete casquee en gros plan 3/4)
rig = G.build_character('bretteur', 0, prefix='icon_')
G.apply_pose(rig, G.get_pose('bretteur', 'idle', 0), direction_deg=22)

cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 52
cam = bpy.data.objects.new('cam', cam_data)
bpy.context.collection.objects.link(cam)
head_z = 1.45
cam.location = (-1.15, -2.65, head_z + 0.55)
import mathutils
d = mathutils.Vector((0 - cam.location.x, 0 - cam.location.y, head_z + 0.22 - cam.location.z))
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam

def area(name, energy, color, loc, size, tz):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.color = color
    ld.size = size
    lo = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(lo)
    lo.location = loc
    dd = mathutils.Vector((0 - loc[0], 0 - loc[1], tz - loc[2]))
    lo.rotation_euler = dd.to_track_quat('-Z', 'Y').to_euler()

area('key', 130, (1.0, 0.9, 0.75), (-2.2, -1.8, 2.8), 1.8, head_z)
area('fill', 28, (0.5, 0.6, 1.0), (2.0, -1.5, 1.2), 2.4, head_z)
area('rim', 200, (1.0, 0.45, 0.12), (1.4, 2.0, 2.4), 1.2, head_z)

G.render_to(DEST + '/icon.png')
print('ICON OK — TITLE/ICON TERMINE en %.0fs' % (time.time() - t0))
