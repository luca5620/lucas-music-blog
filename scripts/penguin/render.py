"""Rebuildable mascot scene — a whole standing chick, in real down.

Round 2 (2026-09-15). What changed after Luca saw round 1: the coat is
REAL HAIR (Cycles curves under a Principled Hair shader) instead of
short triangle tufts, so the silhouette is fuzzy the way the reference
photograph is; the bird is a WHOLE standing penguin with feet, not a
portrait crop in a circle; and the eyes and beak are kept bald so they
read at badge size.

Two Blender traps are load-bearing here, both found the hard way:
  * ParticleSettings.material is ONE-BASED. Slot 0 is index 1, and a
    fur system pointed at the wrong number renders in the skin
    material — which is what made round 1 look like smooth plastic.
  * factor_random is in emitter VELOCITY units, not a fraction of the
    hair length. 0.45 there grows half-unit hairs and the chick
    disappears inside a cotton ball.

Run with Blender 4.5 LTS from the repository root:
    blender --background --python scripts/penguin/render.py -- --header-only
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/penguin'
FRAMES = OUT / 'frames'
OUT.mkdir(parents=True, exist_ok=True)
FRAMES.mkdir(exist_ok=True)
POSTER_SAMPLES = int(([a.split('=')[1] for a in ARGS if a.startswith('--samples=')] or [160])[0])
FRAME_SAMPLES = max(24, POSTER_SAMPLES // 4)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# ---------------------------------------------------------------- GPU
prefs = bpy.context.preferences.addons['cycles'].preferences
for dev_type in ('OPTIX', 'HIP', 'CUDA', 'ONEAPI'):
    try:
        prefs.compute_device_type = dev_type
        prefs.get_devices()
        if any(d.type == dev_type for d in prefs.devices):
            for d in prefs.devices:
                d.use = (d.type == dev_type)
            bpy.context.scene.cycles.device = 'GPU'
            print('RENDER DEVICE:', dev_type)
            break
    except Exception:
        continue

# ---------------------------------------------------------- materials
def skin(name, color, roughness=.8):
    """Under-fur skin. Same colour as the down above it, so any gap in
    the coat reads as shadow rather than as bare plastic."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = roughness
    return m


def hair(name, color, rough=.28, radial=.7):
    """Principled Hair. Melanin parametrisation is the physical one but
    colour is what we can art-direct against the reference."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    h = nt.nodes.new('ShaderNodeBsdfHairPrincipled')
    try:
        h.parametrization = 'COLOR'
    except Exception:
        pass
    for socket, value in (('Color', (*color, 1)), ('Roughness', rough),
                          ('Radial Roughness', radial), ('Random Color', .08),
                          ('Random Roughness', .15)):
        if socket in h.inputs:
            h.inputs[socket].default_value = value
    nt.links.new(h.outputs[0], out.inputs['Surface'])
    return m


def plastic(name, color, roughness, sheen=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bs = nt.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = roughness
    if sheen:
        bs.inputs['Sheen Weight'].default_value = sheen
        tex = nt.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = 240
        bump = nt.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .22
        bump.inputs['Distance'].default_value = .02
        nt.links.new(tex.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], bs.inputs['Normal'])
    return m


DARK = (.008, .009, .011)
IVORY = (.88, .865, .82)
BODY = (.34, .355, .375)

skin_dark = skin('Crown skin', DARK)
skin_ivory = skin('Face skin', IVORY)
skin_body = skin('Body skin', BODY)
down_dark = hair('Black crown down', DARK, rough=.32)
down_ivory = hair('Ivory face down', (.985, .975, .95), rough=.20)
down_body = hair('Silver body down', BODY, rough=.26)

mat_shell = plastic('Matte graphite shells', (.014, .016, .020), .38)
mat_pad = plastic('Leather cushions', (.008, .009, .012), .68, sheen=.35)
mat_beak = plastic('Charcoal beak', (.045, .043, .042), .75)
mat_eye = plastic('Wet eye', (.0015, .0015, .002), .035)

# ------------------------------------------------------------ rigging
def control(name, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.parent = parent
    return obj


root = control('Chick / landing', (0, 0, 0))
head = control('Head / look and nod', (0, 0, 2.28), root)
phones = control('Headphones / weighted settle', (0, 0, 0), head)

HEAD_R = (.80, .70, .80)
BODY_R = (.86, .70, 1.10)
BODY_C = (0, .02, 1.22)


def ellipsoid(name, location, scale, mat, parent, segments=128, rings=88):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.scale = scale
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


# ------------------------------------------------------- face pattern
def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def face_white(co):
    """1 = ivory face down, 0 = black hood down, on the head sphere in
    local (unit) coordinates. The reference chick wears a black hood:
    crown, back and the sides past the ears are dark, and a broad ivory
    mask covers the front of the face around the eyes, stopping at a
    small dark bib under the beak."""
    x, y, z = co
    if y > -.10:                      # back of the head is all hood
        return 0.0
    white = smoothstep(.40, .14, z)              # hood line across the brow
    white *= smoothstep(-.10, -.32, y)           # front of the face only
    white *= smoothstep(.92, .58, abs(x))        # hood wraps past the ears
    bib = (x / .34) ** 2 + ((z + .72) / .34) ** 2
    white *= smoothstep(.45, 1.15, bib)          # dark chin under the beak
    return max(0.0, min(1.0, white))


def bald(co):
    """0 where the coat must stop so a feature can read: the eyes and
    the beak. A chick's down grows right up to them, not over them."""
    x, y, z = co
    if y > -.2:
        return 1.0
    out = 1.0
    for ex in (-.40, .40):
        d = ((x - ex) / .155) ** 2 + ((z - .05) / .155) ** 2
        out = min(out, smoothstep(.55, 1.25, d))
    beak = (x / .155) ** 2 + ((z + .19) / .155) ** 2
    out = min(out, smoothstep(.45, 1.2, beak))
    return out


face = ellipsoid('Chick head', (0, 0, 0), HEAD_R, skin_dark, head)
face.data.materials.append(skin_ivory)
face.data.materials.append(down_dark)
face.data.materials.append(down_ivory)

colors = face.data.color_attributes.new(name='Mask', type='FLOAT_COLOR', domain='POINT')
# Weights go in BUCKETS: one RNA call per weight step instead of one per
# vertex (22k single calls crashed Blender outright).
bpy.context.view_layer.objects.active = face
g_hood = face.vertex_groups.new(name='hood')
g_face = face.vertex_groups.new(name='face')
STEPS = 24
hood_buckets = {}
face_buckets = {}
for v in face.data.vertices:
    w = face_white(v.co)
    b = bald(v.co)
    c = tuple(DARK[i] * (1 - w) + IVORY[i] * w for i in range(3))
    colors.data[v.index].color = (*c, 1)
    hood_buckets.setdefault(round((1 - w) * b * STEPS), []).append(v.index)
    face_buckets.setdefault(round(w * b * STEPS), []).append(v.index)
for group, buckets in ((g_hood, hood_buckets), (g_face, face_buckets)):
    for step, indices in buckets.items():
        group.add(indices, step / STEPS, 'REPLACE')

# The skin under the coat is painted with the same mask, so the boundary
# never shows a hard edge where the hair thins.
skin_mask = bpy.data.materials.new('Head skin (masked)')
skin_mask.use_nodes = True
nt = skin_mask.node_tree
bs = nt.nodes['Principled BSDF']
bs.inputs['Roughness'].default_value = .85
attr = nt.nodes.new('ShaderNodeVertexColor')
attr.layer_name = 'Mask'
nt.links.new(attr.outputs['Color'], bs.inputs['Base Color'])
face.data.materials[0] = skin_mask

body = ellipsoid('Round grey body', BODY_C, BODY_R, skin_body, root)
body.data.materials.append(down_body)

left = control('Left flipper / flick', (-.64, 0, 1.62), root)
right = control('Right flipper', (.64, 0, 1.62), root)
for sign, rig in ((-1, left), (1, right)):
    wing = ellipsoid('Downy flipper', (sign * .12, -.02, -.46), (.20, .30, .70),
                     skin_body, rig, 64, 44)
    wing.data.materials.append(down_body)
    wing.rotation_euler[1] = sign * -.22
    wing['fur'] = True

# ------------------------------------------------------------- feet
# A standing chick: the belly fluff nearly reaches the ground and only
# the front half of each foot shows. Dark grey, three blunt toes, no
# invented cartoon orange.
mat_foot = plastic('Grey foot', (.055, .052, .050), .55)
for sign in (-1, 1):
    foot = ellipsoid('Foot', (sign * .27, -.30, .075), (.20, .30, .075),
                     mat_foot, root, 48, 32)
    for t, tx in enumerate((-.13, 0, .13)):
        toe = ellipsoid('Toe', (sign * .27 + tx, -.55, .07),
                        (.062, .17, .055), mat_foot, root, 32, 20)
        toe.rotation_euler[2] = tx * 1.1

# A small tail nub at the back so the silhouette is a bird, not an egg.
tail = ellipsoid('Tail nub', (0, .58, .52), (.22, .20, .16), skin_body, root, 48, 32)
tail.data.materials.append(down_body)
tail['fur'] = True

# ---------------------------------------------------------------- fur
NOFUR = "--nofur" in ARGS


def fur(obj, slot, length, count, children, group=None, clump=.45,
        rough_end=.55, seed=3):
    """One coat. Children carry the density; the parents only place it.
    Short, dense and slightly clumped is what down looks like — long
    smooth strands read as a wig."""
    if NOFUR:
        return None
    obj.modifiers.new(f'Down {slot}', 'PARTICLE_SYSTEM')
    ps = obj.particle_systems[-1]
    s = ps.settings
    s.name = f'{obj.name} down {slot}'
    s.type = 'HAIR'
    s.count = count
    s.hair_length = length
    s.child_length = 1.0
    s.hair_step = 5
    s.use_advanced_hair = True
    s.material = slot + 1  # ParticleSettings.material is 1-BASED
    s.emit_from = 'FACE'
    s.use_even_distribution = True
    s.distribution = 'RAND'
    s.use_modifier_stack = True
    s.factor_random = length * .05  # VELOCITY units, not a ratio: .45 here grew half-unit hairs
    s.brownian_factor = .0
    s.child_type = 'INTERPOLATED'
    s.rendered_child_count = children
    s.child_percent = max(4, children // 12)
    s.child_radius = length * 0.45
    s.child_roundness = 1.0
    s.clump_factor = clump
    s.clump_shape = .35
    s.roughness_1 = .0
    s.roughness_1_size = .05
    s.roughness_2 = .0
    s.roughness_2_size = .65
    s.roughness_endpoint = .0
    s.kink = 'NO'
    s.kink_amplitude = length * .18
    s.kink_frequency = 1.6
    s.kink_shape = .2
    s.root_radius = 1.0
    s.tip_radius = .04
    s.radius_scale = .004
    s.use_hair_bspline = True
    ps.seed = seed
    if group:
        ps.vertex_group_density = group
    return ps


fur(face, 2, .085, 3000, 100, group='hood', seed=5)
fur(face, 3, .088, 4200, 140, group='face', seed=9)
fur(body, 1, .135, 5200, 120, clump=.38, seed=13)
for obj in bpy.data.objects:
    if obj.get('fur'):
        fur(obj, 1, .090, 1100, 70, seed=21)

# --------------------------------------------------------- the face
for sign in (-1, 1):
    eye = ellipsoid('Glossy eye', (sign * .355, -.635, .040), (.105, .085, .112),
                    mat_eye, head, 64, 44)
    eye.rotation_euler[1] = sign * .10

# A short, blunt chick beak — dark, with a soft ridge; the reference's
# beak is small and points down, it is not a nose.
verts = [(-.120, -.60, -.09), (.120, -.60, -.09), (0, -.64, .055),
         (0, -.86, -.255), (-.098, -.62, -.21), (.098, -.62, -.21)]
mesh = bpy.data.meshes.new('Beak sculpt')
mesh.from_pydata(verts, [], [(0, 2, 3), (2, 1, 3), (1, 5, 3), (5, 4, 3),
                             (4, 0, 3), (0, 4, 5, 1, 2)])
beak = bpy.data.objects.new('Short charcoal beak', mesh)
bpy.context.collection.objects.link(beak)
beak.parent = head
beak.data.materials.append(mat_beak)
mod = beak.modifiers.new('Soft beak edges', 'BEVEL')
mod.width = .022
mod.segments = 4
beak.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
for p in beak.data.polygons:
    p.use_smooth = True

# ---------------------------------------------------------- headphones
for sign in (-1, 1):
    ellipsoid('Oversized padded cushion', (sign * .80, -.02, -.10),
              (.22, .44, .50), mat_pad, phones, 64, 44)
    ellipsoid('Matte ear cup', (sign * .97, .02, -.08), (.115, .38, .44),
              mat_shell, phones, 64, 44)
    ellipsoid('Cup yoke', (sign * 1.00, -.06, .10), (.06, .27, .28),
              mat_shell, phones, 48, 32)


def arc(name, radius_x, radius_z, center_z, thickness, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = thickness
    curve.bevel_resolution = 6
    spline = curve.splines.new('POLY')
    spline.points.add(80)
    for i, p in enumerate(spline.points):
        t = math.pi * i / 80
        p.co = (radius_x * math.cos(t), .03, center_z + radius_z * math.sin(t), 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.parent = phones
    obj.data.materials.append(mat)
    return obj


arc('Continuous padded headband', 1.02, .98, .02, .080, mat_shell)
arc('Underside headband cushion', .97, .90, .04, .046, mat_pad)

# ------------------------------------------------------------- render
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = POSTER_SAMPLES
scene.cycles.use_denoising = True
scene.cycles.use_adaptive_sampling = True
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.resolution_x = 384
scene.render.resolution_y = 512
scene.render.fps = 30
scene.world.color = (.03, .033, .04)
scene.view_settings.view_transform = 'Standard'
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass
try:
    scene.cycles_curves.shape = 'THICK'
    scene.cycles_curves.subdivisions = 2
except Exception:
    pass


def point_at(obj, position):
    obj.rotation_euler = (Vector(position) - obj.location).to_track_quat('-Z', 'Y').to_euler()


bpy.ops.object.camera_add(location=(0, -8, 1.55))
camera = bpy.context.object
camera.name = 'Portrait orthographic camera'
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 3.35  # portrait frame: the bird fills the height
point_at(camera, (0, 0, 1.52))
scene.camera = camera

# Key + fill + a hard rim from behind: the rim is what lights the halo
# of loose down and turns a grey ball into a fluffy animal.
for name, loc, power, size, color in (
        ('Soft key', (-3.2, -4.6, 4.6), 320, 5, (1, .96, .90)),
        ('Quiet fill', (3.4, -4.4, 2.2), 210, 4.5, (.86, .90, 1)),
        ('Face bounce', (0, -5.2, 1.1), 95, 3.5, (1, .98, .96)),
        ('Fur rim', (1.2, 3.6, 4.6), 320, 2.2, (1, .98, .95)),
        ('Brand blue kick', (-2.6, 2.4, 2.2), 12, 2, (.118, .565, 1))):
    bpy.ops.object.light_add(type='AREA', location=loc)
    light = bpy.context.object
    light.name = name
    light.data.energy = power
    light.data.shape = 'DISK'
    light.data.size = size
    light.data.color = color
    point_at(light, (0, 0, 1.5))

# ---------------------------------------------------------- the rig
# Keyed object controls are an intentionally small rig. The GLB carries
# these channels; the site only ever receives the rendered pixels.
for frame, look, nod, flick in ((1, 0, 0, 0), (6, -.10, -.07, -.08),
                                (11, -.07, .07, -.30), (16, .02, .10, -.09),
                                (22, 0, 0, 0)):
    head.rotation_euler = (nod, 0, look)
    left.rotation_euler = (0, flick, 0)
    for rig in (head, left):
        rig.keyframe_insert('rotation_euler', frame=frame)
for frame, height, tilt, settle in ((31, .45, -.06, .10), (38, -.035, .07, -.04),
                                    (44, .02, -.02, .03), (51, 0, 0, 0),
                                    (59, 0, .10, 0), (66, 0, 0, 0), (73, 0, 0, 0)):
    root.location.z = height
    root.keyframe_insert('location', frame=frame)
    head.rotation_euler = (tilt, 0, 0)
    head.keyframe_insert('rotation_euler', frame=frame)
    phones.location.z = settle
    phones.keyframe_insert('location', frame=frame)
scene.frame_start = 1
scene.frame_end = 73
scene.timeline_markers.new('Header: 1-22 (700ms)', frame=1)
scene.timeline_markers.new('Splash: 31-73 (1400ms)', frame=31)
# The splash landing must not interpolate backwards into the header range.
scene.frame_set(1)
root.location = (0, 0, 0)
root.keyframe_insert('location', frame=22)
phones.location = (0, 0, 0)
phones.keyframe_insert('location', frame=22)
scene.frame_set(1)

bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'penguin.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'penguin.glb'), export_format='GLB',
                          export_animations=True)


def render(frame, path, height, samples):
    """Every frame is 3:4 PORTRAIT. A whole standing bird in a square
    box wastes a third of its pixels on empty sides, and at 28px in the
    header there are no pixels to waste."""
    scene.frame_set(frame)
    scene.cycles.samples = samples
    scene.render.resolution_x = round(height * 3 / 4)
    scene.render.resolution_y = height
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


# The poster is the mark most people ever see (low-detail is on by
# default), so it gets the sample budget; the 96px header frames are
# 28px on screen and denoise fine at a fraction of it.
render(1, FRAMES / 'poster.png', 512, POSTER_SAMPLES)
if '--poster-only' not in ARGS:
    for frame in range(1, 23):
        render(frame, FRAMES / f'header-{frame:03}.png', 96, FRAME_SAMPLES)
    if '--header-only' not in ARGS:
        for frame in range(31, 74):
            render(frame, FRAMES / f'splash-{frame:03}.png', 256, FRAME_SAMPLES)
print('RENDER COMPLETE')
