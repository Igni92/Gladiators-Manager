# Rendu du fond d'arene de combat (vue de dessus, 1024x1024, fond plein).
# Geometrie en anneaux plats (tores aplatis) pour que le sable reste visible du dessus.
# /opt/blender/blender -b -P render_arena.py
import sys, os, math, random, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gmlib as G
import gmtown as T
import bpy
from math import radians

DEST = G.ASSETS + '/arena'
os.makedirs(DEST, exist_ok=True)

t0 = time.time()
G.reset_scene()
sc = G.setup_render(res_x=1024, res_y=1024, samples=40, transparent=False)
bg = sc.world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.015, 0.011, 0.009, 1.0)
bg.inputs[1].default_value = 1.0
M = T.mats()
random.seed(7)

root = G.empty('arena_root')

# --- sable avec variations (noise -> deux tons de sable)
m_sand = bpy.data.materials.new('sable_piste')
m_sand.use_nodes = True
nt = m_sand.node_tree
bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.95
noise = nt.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 5.0
noise.inputs['Detail'].default_value = 8.0
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (0.28, 0.19, 0.09, 1)
ramp.color_ramp.elements[1].color = (0.45, 0.33, 0.17, 1)
nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=4.15, depth=0.08, location=(0, 0, -0.04))
sand = bpy.context.active_object
sand.parent = root
sand.data.materials.append(m_sand)

# traces de combat : arcs sombres aleatoires sur le sable
m_trace = G.mat('trace', (0.16, 0.11, 0.05), rough=0.95)
for k in range(12):
    a = random.uniform(0, 2 * math.pi)
    r = random.uniform(0.4, 3.3)
    bpy.ops.mesh.primitive_torus_add(major_radius=random.uniform(0.2, 0.55), minor_radius=0.018,
                                     major_segments=24, minor_segments=6,
                                     location=(r * math.cos(a), r * math.sin(a), 0.004))
    tr = bpy.context.active_object
    tr.parent = root
    tr.scale = (1, random.uniform(0.3, 0.8), 0.12)
    tr.rotation_euler = (0, 0, random.uniform(0, 3))
    tr.data.materials.append(m_trace)

def anneau(name, R, r, zscale, z, mat_):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r,
                                     major_segments=72, minor_segments=14,
                                     location=(0, 0, z))
    o = bpy.context.active_object
    o.name = name
    o.parent = root
    o.scale = (1, 1, zscale)
    o.data.materials.append(mat_)
    for p in o.data.polygons:
        p.use_smooth = True
    return o

# --- bordure de pierre + 2 gradins en anneaux
anneau('mur', 4.32, 0.22, 1.0, 0.10, M['pierre'])
anneau('gradin1', 4.78, 0.42, 0.45, 0.05, M['pierre_clair'])
anneau('gradin2', 5.45, 0.50, 0.55, 0.10, M['pierre'])

crowd_colors = [(0.7, 0.2, 0.15), (0.2, 0.35, 0.6), (0.65, 0.5, 0.15), (0.3, 0.5, 0.25),
                (0.55, 0.3, 0.5), (0.75, 0.65, 0.5), (0.25, 0.25, 0.3), (0.6, 0.4, 0.2)]
crowd_mats = [G.mat('crowd%d' % i, c, rough=0.8) for i, c in enumerate(crowd_colors)]
for ring, (rr, zz) in enumerate([(4.78, 0.26), (5.42, 0.40)]):
    n = 60 + ring * 14
    for k in range(n):
        if random.random() < 0.15:
            continue
        a = k / n * 2 * math.pi + random.uniform(-0.02, 0.02)
        m = random.choice(crowd_mats)
        x, y = rr * math.cos(a), rr * math.sin(a)
        G.sphere('head%d_%d' % (ring, k), root, (x, y, zz + 0.16 + random.uniform(0, 0.05)),
                 (0.085, 0.085, 0.10), m, seg=8, rings=6)
        G.box('body%d_%d' % (ring, k), root, (x, y, zz + 0.02), (0.16, 0.16, 0.2), m, bevel=0)

# --- 4 torches aux "coins" (sur le mur)
for k in range(4):
    a = k * math.pi / 2 + math.pi / 4
    T.torch('torch%d' % k, root, (4.32 * math.cos(a), 4.32 * math.sin(a), 0.2), M, h=0.7)
    ld = bpy.data.lights.new('tl%d' % k, 'POINT')
    ld.energy = 12
    ld.color = (1.0, 0.55, 0.2)
    lo = bpy.data.objects.new('tl%d' % k, ld)
    bpy.context.collection.objects.link(lo)
    lo.location = (4.1 * math.cos(a), 4.1 * math.sin(a), 1.3)

# oriflammes sur la bordure
for a_deg in (0, 90, 180, 270):
    a = radians(a_deg)
    T.flag('af%d' % a_deg, root, (4.32 * math.cos(a), 4.32 * math.sin(a), 0.25), M['bois'], M['rouge'], h=0.85)

# --- camera quasi zenithale + soleil
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 11.6
cam = bpy.data.objects.new('cam', cam_data)
bpy.context.collection.objects.link(cam)
elev = radians(78)
d = 20
cam.location = (0, -d * math.cos(elev), d * math.sin(elev))
cam.rotation_euler = (radians(90) - elev, 0, 0)
sc.camera = cam

sun = bpy.data.lights.new('sun', 'SUN')
sun.energy = 1.5
sun.color = (1.0, 0.93, 0.82)
sun.angle = 0.25
so = bpy.data.objects.new('sun', sun)
bpy.context.collection.objects.link(so)
so.rotation_euler = (radians(40), 0, radians(-30))
fill = bpy.data.lights.new('fill', 'SUN')
fill.energy = 0.35
fill.color = (0.6, 0.7, 1.0)
fill.angle = 1.2
fo = bpy.data.objects.new('fill', fill)
bpy.context.collection.objects.link(fo)
fo.rotation_euler = (radians(55), 0, radians(140))

G.render_to(DEST + '/arena_bg.png')
print('ARENA TERMINE en %.0fs' % (time.time() - t0))
