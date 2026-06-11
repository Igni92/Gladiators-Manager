# Sol du village pré-rendu (1024x1536, fond plein) : terre, herbe, places, chemins.
# Coordonnées alignées sur render/ville.ts : carte 1000x1500 -> plan 10x15.
# /opt/blender/blender -b -P render_ground.py
import sys, os, math, random, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gmlib as G
import gmtown as T
import bpy
from math import radians

DEST = G.ASSETS + '/buildings'
os.makedirs(DEST, exist_ok=True)
t0 = time.time()

G.reset_scene()
sc = G.setup_render(res_x=1024, res_y=1536, samples=40, transparent=False)
bg = sc.world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.02, 0.018, 0.014, 1.0)
M = T.mats()
random.seed(11)


def vers(x, y):
    """carte (0..1000, 0..1500) -> monde blender (x, y)"""
    return ((x - 500) / 100.0, -(y - 750) / 100.0)


# ---- terrain de base : mélange herbe sèche / terre par bruit
m_sol = bpy.data.materials.new('sol')
m_sol.use_nodes = True
nt = m_sol.node_tree
bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.95
noise = nt.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 3.5
noise.inputs['Detail'].default_value = 10.0
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.35
ramp.color_ramp.elements[0].color = (0.13, 0.10, 0.045, 1)   # terre sombre
ramp.color_ramp.elements[1].position = 0.65
ramp.color_ramp.elements[1].color = (0.16, 0.20, 0.055, 1)   # herbe
e = ramp.color_ramp.elements.new(0.5)
e.color = (0.20, 0.17, 0.075, 1)
nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
bmp = nt.nodes.new('ShaderNodeBump')
bmp.inputs['Strength'].default_value = 0.25
nt.links.new(noise.outputs['Fac'], bmp.inputs['Height'])
nt.links.new(bmp.outputs['Normal'], bsdf.inputs['Normal'])
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
sol = bpy.context.active_object
sol.scale = (10.4, 15.6, 1)
sol.data.materials.append(m_sol)

# ---- chemins en sable tassé (courbes aplaties) + place centrale
m_chemin = G.mat('chemin', (0.42, 0.33, 0.18), rough=0.9, bump=0.15)
m_dalle = G.mat('dalle', (0.36, 0.33, 0.28), rough=0.85, bump=0.1)

BATIMENTS = {
    'arene': (500, 300), 'marche': (205, 640), 'caserne': (800, 640),
    'taverne': (195, 1010), 'banque': (805, 1010), 'infirmerie': (500, 1300),
}
PLACE = (500, 880)


def chemin(p1, p2, largeur=0.62):
    """ruban de sable entre deux points carte (via courbe bezier aplatie)"""
    cu = bpy.data.curves.new('chemin', type='CURVE')
    cu.dimensions = '3D'
    cu.fill_mode = 'FULL'
    cu.bevel_depth = largeur
    cu.bevel_resolution = 3
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(1)
    a = vers(*p1)
    b = vers(*p2)
    mid = ((a[0] + b[0]) / 2 + random.uniform(-0.4, 0.4), (a[1] + b[1]) / 2 + random.uniform(-0.3, 0.3))
    sp.bezier_points[0].co = (a[0], a[1], 0.01)
    sp.bezier_points[1].co = (b[0], b[1], 0.01)
    sp.bezier_points[0].handle_right = (mid[0], mid[1], 0.01)
    sp.bezier_points[1].handle_left = (mid[0], mid[1], 0.01)
    for p in sp.bezier_points:
        p.handle_left_type = p.handle_right_type = 'AUTO' if p == sp.bezier_points[0] else p.handle_left_type
    ob = bpy.data.objects.new('chemin', cu)
    bpy.context.collection.objects.link(ob)
    ob.scale = (1, 1, 0.02)
    ob.data.materials.append(m_chemin)
    return ob


for nom, pos in BATIMENTS.items():
    chemin(PLACE, pos, largeur=0.55)
chemin((500, 300), (205, 640), 0.4)
chemin((500, 300), (800, 640), 0.4)

# place centrale dallée + anneau
px, py = vers(*PLACE)
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=2.4, depth=0.03, location=(px, py, 0.012))
place = bpy.context.active_object
place.scale = (1, 0.72, 1)
place.data.materials.append(m_dalle)
# dalles : rainures circulaires
for r in (0.8, 1.5, 2.1):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.025, major_segments=48, minor_segments=6,
                                     location=(px, py, 0.027))
    t = bpy.context.active_object
    t.scale = (1, 0.72, 0.3)
    t.data.materials.append(G.mat('rainure', (0.36, 0.33, 0.28), rough=0.9))

# parvis de l'arène
ax, ay = vers(500, 470)
bpy.ops.mesh.primitive_cylinder_add(vertices=36, radius=1.6, depth=0.025, location=(ax, ay, 0.01))
parvis = bpy.context.active_object
parvis.scale = (1.2, 0.5, 1)
parvis.data.materials.append(m_dalle)

# ---- végétation et cailloux épars
m_herbe = G.mat('herbe_touffe', (0.22, 0.34, 0.10), rough=0.9)
m_herbe2 = G.mat('herbe_touffe2', (0.30, 0.38, 0.12), rough=0.9)
m_caillou = G.mat('caillou', (0.45, 0.42, 0.38), rough=0.9)
m_fleur_r = G.mat('fleur_r', (0.75, 0.25, 0.2), rough=0.6)
m_fleur_j = G.mat('fleur_j', (0.85, 0.7, 0.2), rough=0.6)

def loin_des_chemins(x, y):
    if math.hypot(x - PLACE[0], (y - PLACE[1]) * 1.4) < 290: return False
    for pos in BATIMENTS.values():
        if math.hypot(x - pos[0], y - pos[1]) < 200: return False
    return True

n_poses = 0
essais = 0
while n_poses < 90 and essais < 600:
    essais += 1
    x = random.uniform(30, 970)
    y = random.uniform(60, 1460)
    if not loin_des_chemins(x, y):
        continue
    wx, wy = vers(x, y)
    r = random.random()
    if r < 0.5:  # touffe d'herbe
        for k in range(random.randint(2, 4)):
            G.cone('h%d_%d' % (n_poses, k), None,
                   (wx + random.uniform(-0.08, 0.08), wy + random.uniform(-0.08, 0.08), 0.06),
                   0.05, 0.0, random.uniform(0.12, 0.22),
                   m_herbe if random.random() < 0.6 else m_herbe2, verts=6,
                   rot=(random.uniform(-12, 12), random.uniform(-12, 12), 0))
    elif r < 0.8:  # cailloux
        for k in range(random.randint(1, 3)):
            s = random.uniform(0.05, 0.13)
            G.sphere('c%d_%d' % (n_poses, k), None,
                     (wx + random.uniform(-0.12, 0.12), wy + random.uniform(-0.12, 0.12), s * 0.4),
                     (s, s * 0.8, s * 0.55), m_caillou, seg=8, rings=6)
    else:  # fleurs
        for k in range(random.randint(2, 4)):
            G.cyl('ft%d_%d' % (n_poses, k), None,
                  (wx + random.uniform(-0.15, 0.15), wy + random.uniform(-0.15, 0.15), 0.1),
                  0.012, 0.12, m_herbe, origin='center')
            G.sphere('f%d_%d' % (n_poses, k), None,
                     (wx + random.uniform(-0.15, 0.15), wy + random.uniform(-0.15, 0.15), 0.18),
                     (0.045, 0.045, 0.035), m_fleur_r if random.random() < 0.5 else m_fleur_j, seg=8, rings=6)
    n_poses += 1

# ---- caméra zénithale couvrant exactement 10x15
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 15.0  # axe le plus grand (vertical)
cam = bpy.data.objects.new('cam', cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (0, 0, 20)
cam.rotation_euler = (0, 0, 0)
sc.camera = cam
sc.render.resolution_x = 1024
sc.render.resolution_y = 1536

sun = bpy.data.lights.new('sun', 'SUN')
sun.energy = 1.15
sun.color = (1.0, 0.93, 0.8)
sun.angle = 0.3
so = bpy.data.objects.new('sun', sun)
bpy.context.collection.objects.link(so)
so.rotation_euler = (radians(42), 0, radians(-35))
fill = bpy.data.lights.new('fill', 'SUN')
fill.energy = 0.3
fill.color = (0.6, 0.7, 1.0)
fill.angle = 1.0
fo = bpy.data.objects.new('fill', fill)
bpy.context.collection.objects.link(fo)
fo.rotation_euler = (radians(55), 0, radians(140))

G.render_to(DEST + '/sol_ville.png')
print('SOL TERMINE en %.0fs' % (time.time() - t0))
