"""build_character.py — model the innie in Blender and bake him to JSON.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python 3d-mazeball/assets/build_character.py

Writes `3d-mazeball/assets/doll.json`, which the game loads straight into a
render group. No runtime dependency on Blender — this is a build step whose
output is committed.

WHY BLENDER AT ALL
------------------
The rest of the game is hand-written primitives, and that is right for a maze:
it stays deterministic, it costs nothing, and collision comes out of the same
pass. It is the wrong tool for a character. The MySims look is *subdivision* —
every form is a rounded blob with no hard edge anywhere — and subdivision
surfaces plus bevels are exactly what a modeller gives you and what hand-rolled
boxes cannot.

THE LOOK
--------
MySims proportions, Severance wardrobe. Head roughly half the total height,
no neck, stubby limbs, mitten hands, dot eyes, and a silhouette made entirely
of spheres. The suit stays navy, the shirt white, the tie the same light blue
as the corridor accent line, so he still belongs to the floor he is rolling
down.

SMOOTH NORMALS
--------------
The kit's mesher emits flat geometric normals on purpose — it wants faceted
architecture and it means winding never matters. A bubbly character is the
opposite: it needs averaged vertex normals or the subdivision is wasted. This
exporter writes per-corner smooth normals, and the renderer already accepts
whatever normals a group hands it, so the two coexist without a branch.
"""

import json
import os
import sys

import bpy
import bmesh
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'doll.json')

# Severance wardrobe, unchanged from the hand-built doll so the palette holds.
SUIT = (0.137, 0.173, 0.239)
SUIT_DARK = (0.102, 0.129, 0.188)
SHIRT = (0.949, 0.953, 0.941)
TIE = (0.498, 0.690, 0.804)
SKIN = (0.851, 0.702, 0.608)
HAIR = (0.227, 0.196, 0.161)
EYE = (0.129, 0.118, 0.106)
MOUTH = (0.541, 0.376, 0.353)
SHOE = (0.082, 0.094, 0.122)
BADGE = (0.812, 0.890, 0.933)


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.objects):
        for item in list(block):
            try:
                block.remove(item)
            except Exception:
                pass


def _finish(ob, name, colour, subdiv):
    ob.name = name
    ob.color = (*colour, 1.0)          # so the Workbench turnaround shows wardrobe
    bpy.ops.object.shade_smooth()
    if subdiv:
        m = ob.modifiers.new('sub', 'SUBSURF')
        m.levels = m.render_levels = subdiv
    return ob, colour


def ball(name, loc, radius, colour, scale=(1, 1, 1), subdiv=0, seg=14, ring=7):
    """A sphere is the base unit of this character. Everything is a sphere.

    Deliberately low-poly. The DS budget is part of the look, and a smooth-shaded
    14x7 sphere reads as round at any size this character is ever drawn — the
    first pass ran subdivision twice on a 24x12 sphere and produced an 18 MB,
    85,000-triangle asset for something 40 pixels tall.
    """
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring,
                                         radius=radius, location=loc)
    ob = bpy.context.active_object
    ob.scale = scale
    return _finish(ob, name, colour, subdiv)


def blob(name, loc, size, colour, round=0.62, subdiv=1, rot=(0, 0, 0)):
    """A cube rounded until it stops being a cube. The MySims workhorse.

    `size` is the full extent in metres and `round` is the corner radius as a
    fraction of the smallest half-extent, so `round=1` is a capsule and 0 is a
    hard box. Scale is applied *before* the bevel: the modifier works in local
    units, so on an unapplied 0.1-scaled cube a 0.03 bevel silently becomes a
    0.003 world chamfer — which is why the first turnaround came back boxy.
    """
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    b = ob.modifiers.new('bevel', 'BEVEL')
    b.width = round * min(size) * 0.5
    b.segments = 3
    b.limit_method = 'ANGLE'
    b.angle_limit = 0.6
    return _finish(ob, name, colour, subdiv)


def build():
    parts = []

    # ── head: the whole silhouette hangs off this ──────────────────────────
    parts.append(ball('head', (0, 0, 0.13), 0.175, SKIN, scale=(1.0, 0.94, 0.98)))
    # Hair. Pushed *back* rather than merely up: a cap concentric with the skull
    # is by definition larger than it everywhere, so it came down over the brow
    # and buried the eyes. Offsetting it in Y leaves the face bare and puts the
    # volume where a hairline actually is, with a separate fringe at brow height.
    parts.append(ball('hair', (0, 0.030, 0.150), 0.180, HAIR, scale=(1.0, 0.98, 1.02)))
    parts.append(ball('fringe', (0, -0.020, 0.222), 0.115, HAIR,
                      scale=(1.30, 1.35, 0.40), seg=12, ring=6))
    # Dot eyes. Big, flat and sunk into the skull — an early pass had them
    # standing off the face as two lumps visible in profile.
    for s in (-1, 1):
        parts.append(ball(f'eye{s}', (s * 0.072, -0.118, 0.128), 0.044, EYE,
                          scale=(0.78, 0.32, 1.10), seg=12, ring=6))
    parts.append(ball('mouth', (0, -0.132, 0.048), 0.040, MOUTH,
                      scale=(0.95, 0.30, 0.34), seg=12, ring=6))
    # ears, tucked flat
    for s in (-1, 1):
        parts.append(ball(f'ear{s}', (s * 0.166, 0.005, 0.112), 0.034, SKIN,
                          scale=(0.45, 0.95, 1.15), seg=10, ring=5))

    # ── body: small, round, no neck ────────────────────────────────────────
    parts.append(blob('torso', (0, 0, -0.078), (0.190, 0.140, 0.205), SUIT, round=0.75))
    parts.append(blob('shirt', (0, -0.062, -0.058), (0.085, 0.035, 0.150), SHIRT,
                      round=0.5, subdiv=0))
    parts.append(blob('tie', (0, -0.078, -0.088), (0.034, 0.022, 0.120), TIE,
                      round=0.6, subdiv=0))
    parts.append(blob('collar', (0, -0.032, 0.012), (0.105, 0.080, 0.034), SHIRT,
                      round=0.7, subdiv=0))
    # lapels
    for s in (-1, 1):
        parts.append(blob(f'lapel{s}', (s * 0.054, -0.066, -0.032),
                          (0.048, 0.018, 0.105), SUIT_DARK,
                          round=0.5, subdiv=0, rot=(0, s * 0.30, 0)))

    # ── arms: stubby, ending in mittens ────────────────────────────────────
    # Pulled in to overlap the torso — held out at 0.155 they floated free of the
    # shoulder with daylight between the two.
    for s in (-1, 1):
        parts.append(blob(f'arm{s}', (s * 0.133, 0, -0.058), (0.080, 0.090, 0.160),
                          SUIT, round=0.9))
        parts.append(ball(f'mitt{s}', (s * 0.146, -0.006, -0.148), 0.058, SKIN,
                          scale=(0.92, 0.82, 1.0)))

    # ── legs: barely there, which is the joke ──────────────────────────────
    for s in (-1, 1):
        parts.append(blob(f'leg{s}', (s * 0.060, 0, -0.212), (0.088, 0.088, 0.105),
                          SUIT_DARK, round=0.95))
        parts.append(blob(f'shoe{s}', (s * 0.060, -0.026, -0.270),
                          (0.100, 0.140, 0.062), SHOE, round=0.85))

    # ── the badge, so the spin has something to read against ───────────────
    # Clipped to his right lapel. Dead centre it simply covered the tie.
    parts.append(blob('badge', (0.078, -0.070, -0.088), (0.048, 0.010, 0.064), BADGE,
                      round=0.4, subdiv=0))
    return parts


def export(parts):
    """Bake every part down to one interleavable triangle soup.

    Colour is stored per *part* as a run, not per vertex: the character has 21
    parts and ~14,000 vertices, so a per-vertex colour array would be a third of
    the file to say the same nine things. The loader expands the runs.
    """
    dg = bpy.context.evaluated_depsgraph_get()
    positions, normals, runs = [], [], []

    for ob, colour in parts:
        eval_ob = ob.evaluated_get(dg)
        mesh = eval_ob.to_mesh()
        mesh.transform(eval_ob.matrix_world)

        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.to_mesh(mesh)
        bm.free()

        mesh.calc_loop_triangles()
        # Smooth per-corner normals. The API moved in 4.1; try the modern one
        # and fall back so this keeps working on an older Blender.
        try:
            corner = [tuple(v.vector) for v in mesh.corner_normals]
        except (AttributeError, RuntimeError):
            mesh.calc_normals_split()
            corner = [tuple(loop.normal) for loop in mesh.loops]

        start = len(positions) // 3
        for tri in mesh.loop_triangles:
            for k in range(3):
                v = mesh.vertices[tri.vertices[k]].co
                n = corner[tri.loops[k]]
                # Blender Z-up → game Y-up, and turned to face −Z. The game's
                # ballMatrix yaws by heading + pi because "the model faces local
                # −Z"; exported facing +Z he ran down the corridor backwards.
                positions.extend((-v.x, v.z, v.y))
                normals.extend((-n[0], n[2], n[1]))

        runs.append({
            'name': ob.name,
            'color': [round(c, 4) for c in colour],
            'start': start,
            'count': len(positions) // 3 - start,
        })
        eval_ob.to_mesh_clear()

    return positions, normals, runs


def preview():
    """Four turnaround stills, so proportions get checked before the game does.

    Workbench because this runs headless — EEVEE needs a GPU context that a
    background process on macOS does not reliably get, and flat-lit turnarounds
    are what a proportion check wants anyway.
    """
    import math
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = scene.render.resolution_y = 420
    scene.render.film_transparent = False
    scene.world = scene.world or bpy.data.worlds.new('w')
    scene.world.color = (0.09, 0.10, 0.11)
    shading = scene.display.shading
    shading.light = 'STUDIO'
    shading.color_type = 'OBJECT'

    bpy.ops.object.camera_add(location=(0, -1.5, 0.0), rotation=(math.pi / 2, 0, 0))
    cam = bpy.context.active_object
    cam.data.lens = 60
    scene.camera = cam

    bpy.ops.object.empty_add(location=(0, 0, -0.02))
    pivot = bpy.context.active_object
    cam.parent = pivot

    out = os.path.join(os.path.dirname(OUT), 'preview')
    for i, label in enumerate(('front', 'left', 'back', 'right')):
        pivot.rotation_euler = (0, 0, i * math.pi / 2)
        scene.render.filepath = f'{out}-{label}.png'
        bpy.ops.render.render(write_still=True)
    return [f'{out}-{n}.png' for n in ('front', 'left', 'back', 'right')]


def main():
    clear()
    parts = build()
    positions, normals, runs = export(parts)

    # Seat him on the ball's centre. He tumbles end over end inside a 0.35 m
    # sphere, so an off-centre model wobbles as if it were mounted crooked —
    # modelled from the waist he sits 46 mm high.
    mid = (max(positions[1::3]) + min(positions[1::3])) / 2
    for i in range(1, len(positions), 3):
        positions[i] -= mid

    lo = [min(positions[i::3]) for i in range(3)]
    hi = [max(positions[i::3]) for i in range(3)]
    data = {
        'source': '3d-mazeball/assets/build_character.py',
        'blender': bpy.app.version_string,
        'triangles': len(positions) // 9,
        'bounds': {'lo': lo, 'hi': hi},
        'parts': runs,
        'positions': [round(v, 4) for v in positions],
        'normals': [round(v, 3) for v in normals],
    }
    with open(OUT, 'w') as f:
        json.dump(data, f)

    sys.stderr.write(
        f'doll.json: {data["triangles"]} triangles, {len(runs)} parts, '
        f'{os.path.getsize(OUT) / 1024:.0f} KB, '
        f'height {hi[1] - lo[1]:.3f} m, width {hi[0] - lo[0]:.3f} m\n')

    if '--preview' in sys.argv:
        for p in preview():
            sys.stderr.write(f'preview: {p}\n')


main()
