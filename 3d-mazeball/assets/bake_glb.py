"""bake_glb.py — bake a textured GLB down to the game's flat vertex arrays.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python 3d-mazeball/assets/bake_glb.py \
        -- in.glb out.json [--scale S] [--name NAME] [--flip]

    # with no input file: build a textured test cube, bake it, check the round
    # trip, and exit non-zero if anything is off
    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python 3d-mazeball/assets/bake_glb.py -- --selftest

WHY THIS EXISTS
---------------
Thrixel hands back game props as GLB with PBR textures. `review/gl.js` has no
texture support whatsoever — a render group is a flat array of positions, a
flat array of normals, and a colour, and that is the entire vocabulary. So the
texture has to be resolved at *build* time: for every vertex, look up the
material's base-colour image at that vertex's UV and keep the answer as a
colour. The GLB never ships; the JSON does, exactly as `doll.json` does.

RELATIONSHIP TO build_character.py
----------------------------------
Same schema, same axis map, one deliberate difference.

`build_character.py` builds its man out of ~21 solid-coloured parts, so it
stores ONE COLOUR PER PART as a `{start, count}` run over the vertex arrays and
the loader expands the runs. That encoding exists because 21 parts against
23,000 vertices makes a per-vertex colour array about a third of the file to
say nine things.

A texture-baked mesh has no such structure. Every vertex can be a different
colour, which is the whole point of baking a texture, so the run encoding
cannot represent it. This exporter therefore adds a top-level

    "colors": [r, g, b, ...]      # one triple per vertex, parallel to positions

and still emits `parts`, one entry per object/material run, for provenance —
and so that anything reading only `parts` (the review page's toolbar, a quick
eyeball of the JSON) still gets a sane representative colour, namely the mean
of that run's baked vertices. A loader should prefer `colors` when present.

Everything else matches: `{source, blender, triangles, bounds:{lo,hi}, parts,
positions, normals}`, flat float arrays, game axes, metres.

AXIS MAP
--------
Copied from `export()` in build_character.py and must stay identical:

    positions:  (x, y, z)_blender  ->  (-x,  z,  y)_game
    normals:    (x, y, z)_blender  ->  (-x,  z,  y)_game

Blender is Z-up; the game is Y-up and `ballMatrix()` in `review/severed.js`
yaws by heading + pi on the basis that the model faces local -Z. The map has
determinant +1, so it is a rotation and winding survives it unchanged — which
is what lets the inside-out check below run in either space with one answer.

This lines up with the glTF importer by luck rather than accident: glTF is
Y-up with models facing +Z, the importer rotates that to Blender Z-up with the
model facing -Y, and -Y in Blender is exactly the facing build_character.py
models by hand. A Thrixel prop generated "facing the camera" comes out facing
the same way the man does.

COLOUR SPACE
------------
The game's colours are plain sRGB 0-1 — `SUIT = (0.137, 0.173, 0.239)` in
build_character.py is just #232C3D divided by 255. Baked colours have to land
in the same space or the prop will not match the corridor it stands in.

  * Byte images (every PNG/JPEG a GLB carries) store sRGB-encoded bytes, and
    `image.pixels` hands those back raw as byte/255. That is already the space
    we want, so texture samples are used as-is.
  * Float images are scene-linear, so those samples get encoded to sRGB.
  * The Principled BSDF's Base Color default_value is scene-linear too, so the
    no-texture factor fallback gets encoded to sRGB as well.

SPEED
-----
`image.pixels` is a property, not a buffer: touching it re-reads the whole
image out of Blender, so sampling N vertices by indexing `image.pixels[i]`
costs N full image reads and takes minutes on a 2K texture. Each image is read
into a plain Python list exactly once, in `pixels_of()`, and indexed from
there.

THE INSIDE-OUT TRAP
-------------------
Thrixel models frequently come out inside out, and the obvious check does not
catch it: winding and stored normals *agree with each other* while both point
inward, so any test that compares the two is satisfied. Catching it needs a
world-space question — do the surfaces face away from the inside of the model?

`orientation()` answers it two ways and prints both:

  * signed volume about the origin (exact for a closed mesh: positive means
    counter-clockwise/outward winding, negative means inside out), and
  * the fraction of surface AREA whose winding normal points away from the
    mesh's area-weighted centroid, which still says something useful on the
    open, non-manifold shells a generator tends to produce.

It also reports whether the stored normals agree with the winding, purely so
the "they agree and are both wrong" case is visible rather than reassuring.

`--flip` reverses triangle winding and negates normals, and the verdict is
re-printed afterwards so the fix can be confirmed in the same run.
"""

import json
import math
import os
import sys

import bpy
import bmesh


MID_GREY = (0.5, 0.5, 0.5)          # last-resort colour: no material at all

# Cache of image name -> (width, height, channels, pixels list, is_float).
# See SPEED above: this is the difference between seconds and minutes.
_PIXELS = {}


# ──────────────────────────────────────────────────────────────────────────
# colour
# ──────────────────────────────────────────────────────────────────────────

def srgb(c):
    """Scene-linear -> sRGB 0-1, the space the game's palette is written in."""
    if c <= 0.0:
        return 0.0
    if c >= 1.0:
        return 1.0
    if c <= 0.0031308:
        return 12.92 * c
    return 1.055 * (c ** (1.0 / 2.4)) - 0.055


def pixels_of(image):
    """Read an image into a Python list ONCE. Returns None if unusable."""
    key = image.name_full
    if key in _PIXELS:
        return _PIXELS[key]

    entry = None
    width, height = image.size
    channels = image.channels
    if width > 0 and height > 0 and channels >= 3:
        count = width * height * channels
        buf = [0.0] * count
        try:
            image.pixels.foreach_get(buf)
        except (AttributeError, TypeError, RuntimeError):
            buf = list(image.pixels)
        if len(buf) >= count:
            entry = (width, height, channels, buf, bool(image.is_float))
    _PIXELS[key] = entry
    return entry


def _texel(t, n):
    """UV coordinate -> texel index, nearest, tiling outside [0, 1]."""
    if t < 0.0 or t > 1.0:
        t -= math.floor(t)              # tile, the way a sampler would
    i = int(t * n)
    if i >= n:
        i = n - 1                       # u == 1.0 is the LAST texel, not the first
    elif i < 0:
        i = 0
    return i


def sample(entry, u, v):
    """Nearest-pixel lookup. Blender's rows run bottom-up and so does its V,
    so no flip is needed here — the glTF importer already flipped the UVs."""
    width, height, channels, buf, is_float = entry
    i = (_texel(v, height) * width + _texel(u, width)) * channels
    r, g, b = buf[i], buf[i + 1], buf[i + 2]
    if is_float:
        return (srgb(r), srgb(g), srgb(b))
    return (r, g, b)


def _image_upstream(socket):
    """First image texture reachable from a socket, breadth-first.

    glTF materials put the base-colour image straight into Base Color, but a
    baseColorFactor other than white arrives as a Mix node in between, and
    edited materials can stack more, so this walks rather than assumes.
    """
    if not socket.is_linked:
        return None
    queue = [link.from_node for link in socket.links]
    seen = set()
    while queue:
        node = queue.pop(0)
        if id(node) in seen:
            continue
        seen.add(id(node))
        if node.type == 'TEX_IMAGE' and node.image is not None:
            return node.image
        for inp in node.inputs:
            for link in inp.links:
                queue.append(link.from_node)
    return None


def base_colour_of(material):
    """('tex', image) | ('rgb', (r, g, b)) | None, in that order of preference."""
    if material is None:
        return None

    if not material.use_nodes:
        c = material.diffuse_color
        return ('rgb', (srgb(c[0]), srgb(c[1]), srgb(c[2])))

    nodes = list(material.node_tree.nodes)
    principled = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if principled is not None and 'Base Color' in principled.inputs:
        socket = principled.inputs['Base Color']
        image = _image_upstream(socket)
        if image is not None:
            return ('tex', image)
        c = socket.default_value                      # scene-linear factor
        return ('rgb', (srgb(c[0]), srgb(c[1]), srgb(c[2])))

    emission = next((n for n in nodes if n.type == 'EMISSION'), None)
    if emission is not None:
        image = _image_upstream(emission.inputs['Color'])
        if image is not None:
            return ('tex', image)
        c = emission.inputs['Color'].default_value
        return ('rgb', (srgb(c[0]), srgb(c[1]), srgb(c[2])))

    image = next((n.image for n in nodes
                  if n.type == 'TEX_IMAGE' and n.image is not None), None)
    if image is not None:
        return ('tex', image)

    c = material.diffuse_color
    return ('rgb', (srgb(c[0]), srgb(c[1]), srgb(c[2])))


# ──────────────────────────────────────────────────────────────────────────
# bake
# ──────────────────────────────────────────────────────────────────────────

def corner_normals(mesh):
    """Per-corner normals. The API moved in 4.1; fall back like the other
    exporter does so this keeps working on an older Blender."""
    try:
        return [tuple(v.vector) for v in mesh.corner_normals]
    except (AttributeError, RuntimeError):
        mesh.calc_normals_split()
        return [tuple(loop.normal) for loop in mesh.loops]


def bake():
    """Every mesh in the scene -> (positions, normals, colors, parts).

    Triangle soup, three unshared vertices per triangle, so a vertex is a
    corner and its UV is unambiguous even where the texture seams split it.
    """
    depsgraph = bpy.context.evaluated_depsgraph_get()
    positions, normals, colors, parts = [], [], [], []

    for ob in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
        eval_ob = ob.evaluated_get(depsgraph)
        mesh = eval_ob.to_mesh()
        if mesh is None:
            continue
        matrix = eval_ob.matrix_world
        mesh.transform(matrix)
        # A mirrored object (negative determinant) comes out of transform()
        # with its winding reversed. Undo that here rather than letting it
        # look like the inside-out bug further down.
        mirrored = matrix.determinant() < 0.0

        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.to_mesh(mesh)
        bm.free()

        mesh.calc_loop_triangles()
        corner = corner_normals(mesh)
        uv_data = mesh.uv_layers.active.data if mesh.uv_layers.active else None
        slots = [s.material for s in eval_ob.material_slots] or [None]

        # Group by material so each part is one contiguous run, the way
        # build_character.py's runs are contiguous.
        by_material = {}
        for tri in mesh.loop_triangles:
            by_material.setdefault(tri.material_index, []).append(tri)

        for index in sorted(by_material):
            material = slots[index] if index < len(slots) else None
            spec = base_colour_of(material)
            entry = pixels_of(spec[1]) if spec and spec[0] == 'tex' else None
            if spec is None:
                fallback = MID_GREY
            elif spec[0] == 'rgb':
                fallback = spec[1]
            else:
                fallback = MID_GREY     # texture exists but is unreadable

            start = len(positions) // 3
            sums = [0.0, 0.0, 0.0]
            order = (0, 2, 1) if mirrored else (0, 1, 2)

            for tri in by_material[index]:
                for k in order:
                    loop = tri.loops[k]
                    v = mesh.vertices[tri.vertices[k]].co
                    n = corner[loop]
                    if entry is not None and uv_data is not None:
                        uv = uv_data[loop].uv
                        rgb = sample(entry, uv[0], uv[1])
                    else:
                        rgb = fallback
                    # Blender Z-up -> game Y-up, turned to face -Z.
                    positions.extend((-v.x, v.z, v.y))
                    normals.extend((-n[0], n[2], n[1]))
                    colors.extend(rgb)
                    sums[0] += rgb[0]
                    sums[1] += rgb[1]
                    sums[2] += rgb[2]

            count = len(positions) // 3 - start
            if count == 0:
                continue
            name = ob.name
            if len(by_material) > 1:
                name = '%s:%s' % (ob.name, material.name if material else 'none')
            parts.append({
                'name': name,
                'color': [round(c / count, 4) for c in sums],
                'start': start,
                'count': count,
            })

        eval_ob.to_mesh_clear()

    return positions, normals, colors, parts


def apply_scale(positions, scale):
    if scale == 1.0:
        return positions
    return [p * scale for p in positions]


def bounds_of(positions):
    if not positions:
        return [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]
    lo = [min(positions[i::3]) for i in range(3)]
    hi = [max(positions[i::3]) for i in range(3)]
    return lo, hi


def flip_inside_out(positions, normals, colors):
    """Reverse winding and negate normals, in place.

    Winding is reversed by swapping corners 1 and 2 of every triangle, which
    has to happen in positions, normals AND colors or the vertex colours end
    up shuffled against the geometry they were sampled for.
    """
    for i in range(0, len(positions), 9):
        for a, b in ((i + 3, i + 6), (i + 4, i + 7), (i + 5, i + 8)):
            positions[a], positions[b] = positions[b], positions[a]
            normals[a], normals[b] = normals[b], normals[a]
        for a, b in ((i + 3, i + 6), (i + 4, i + 7), (i + 5, i + 8)):
            colors[a], colors[b] = colors[b], colors[a]
    for i in range(len(normals)):
        normals[i] = -normals[i]


# ──────────────────────────────────────────────────────────────────────────
# the inside-out check
# ──────────────────────────────────────────────────────────────────────────

def orientation(positions, normals):
    """Do the surfaces actually face outward? See THE INSIDE-OUT TRAP above.

    Returns a dict; `verdict` is one of 'outward', 'inside-out', 'unclear',
    'empty'.
    """
    n_tri = len(positions) // 9
    if n_tri == 0:
        return {'triangles': 0, 'verdict': 'empty', 'outward': 0.0,
                'volume': 0.0, 'agree': 0.0, 'closed': False}

    geo = []            # (area, centre, unit winding normal, mean stored normal)
    volume = 0.0
    area_total = 0.0
    centroid = [0.0, 0.0, 0.0]

    for t in range(n_tri):
        o = t * 9
        ax, ay, az = positions[o], positions[o + 1], positions[o + 2]
        bx, by, bz = positions[o + 3], positions[o + 4], positions[o + 5]
        cx, cy, cz = positions[o + 6], positions[o + 7], positions[o + 8]

        ux, uy, uz = bx - ax, by - ay, bz - az
        vx, vy, vz = cx - ax, cy - ay, cz - az
        nx = uy * vz - uz * vy
        ny = uz * vx - ux * vz
        nz = ux * vy - uy * vx
        length = math.sqrt(nx * nx + ny * ny + nz * nz)
        if length <= 1e-12:
            continue                                    # degenerate sliver
        area = 0.5 * length
        centre = ((ax + bx + cx) / 3.0, (ay + by + cy) / 3.0, (az + bz + cz) / 3.0)

        # Signed volume of the tetrahedron (origin, a, b, c). Summed over a
        # closed mesh this is the enclosed volume, signed by winding.
        volume += (ax * (by * cz - bz * cy)
                   - ay * (bx * cz - bz * cx)
                   + az * (bx * cy - by * cx)) / 6.0

        sx = sy = sz = 0.0
        for k in range(3):
            sx += normals[o + k * 3]
            sy += normals[o + k * 3 + 1]
            sz += normals[o + k * 3 + 2]

        geo.append((area, centre, (nx / length, ny / length, nz / length),
                    (sx, sy, sz)))
        area_total += area
        centroid[0] += centre[0] * area
        centroid[1] += centre[1] * area
        centroid[2] += centre[2] * area

    if area_total <= 0.0:
        return {'triangles': n_tri, 'verdict': 'unclear', 'outward': 0.0,
                'volume': 0.0, 'agree': 0.0, 'closed': False}

    centroid = [c / area_total for c in centroid]

    outward_area = 0.0
    agree_area = 0.0
    for area, centre, wind, stored in geo:
        rx = centre[0] - centroid[0]
        ry = centre[1] - centroid[1]
        rz = centre[2] - centroid[2]
        if wind[0] * rx + wind[1] * ry + wind[2] * rz > 0.0:
            outward_area += area
        if wind[0] * stored[0] + wind[1] * stored[1] + wind[2] * stored[2] > 0.0:
            agree_area += area

    lo, hi = bounds_of(positions)
    box = max((hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]), 1e-12)
    outward = outward_area / area_total

    # A mesh that encloses a real fraction of its own bounding box is closed
    # enough to trust the signed volume, which is exact. Otherwise fall back
    # to the area vote, which at least says something about an open shell.
    closed = abs(volume) > 0.05 * box
    if closed:
        verdict = 'outward' if volume > 0.0 else 'inside-out'
    elif outward >= 0.6:
        verdict = 'outward'
    elif outward <= 0.4:
        verdict = 'inside-out'
    else:
        verdict = 'unclear'

    return {'triangles': n_tri, 'verdict': verdict, 'outward': outward,
            'volume': volume, 'agree': agree_area / area_total, 'closed': closed}


def report_orientation(label, info):
    sys.stderr.write(
        '%s: %s (%.0f%% of surface area faces outward, signed volume %+.5f m3 '
        '[%s], winding and stored normals agree on %.0f%%)\n'
        % (label, info['verdict'].upper(), 100.0 * info['outward'],
           info['volume'], 'closed' if info['closed'] else 'open shell',
           100.0 * info['agree']))
    if info['verdict'] == 'inside-out':
        sys.stderr.write(
            '  ^ this is the known Thrixel failure. Re-run with --flip.\n')


# ──────────────────────────────────────────────────────────────────────────
# scene / io
# ──────────────────────────────────────────────────────────────────────────

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.objects):
        for item in list(block):
            try:
                block.remove(item)
            except Exception:
                pass
    _PIXELS.clear()


def write(out_path, source, name, positions, normals, colors, parts):
    lo, hi = bounds_of(positions)
    data = {
        'source': source,
        'name': name,
        'blender': bpy.app.version_string,
        'triangles': len(positions) // 9,
        'bounds': {'lo': lo, 'hi': hi},
        'parts': parts,
        'positions': [round(v, 4) for v in positions],
        'normals': [round(v, 3) for v in normals],
        # The one schema difference from build_character.py: a colour per
        # VERTEX, because a baked texture has no per-part structure to exploit.
        'colors': [round(v, 4) for v in colors],
    }
    with open(out_path, 'w') as f:
        json.dump(data, f)
    return data, lo, hi


def summarise(out_path, data, lo, hi):
    sys.stderr.write(
        '%s: %d triangles, %d parts, %.0f KB, bbox %.3f x %.3f x %.3f m\n'
        % (os.path.basename(out_path), data['triangles'], len(data['parts']),
           os.path.getsize(out_path) / 1024.0,
           hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]))


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    opts = {'input': None, 'output': None, 'scale': 1.0, 'name': None,
            'flip': False, 'selftest': False}
    positional = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--scale':
            i += 1
            opts['scale'] = float(argv[i])
        elif a.startswith('--scale='):
            opts['scale'] = float(a.split('=', 1)[1])
        elif a == '--name':
            i += 1
            opts['name'] = argv[i]
        elif a.startswith('--name='):
            opts['name'] = a.split('=', 1)[1]
        elif a == '--flip':
            opts['flip'] = True
        elif a == '--selftest':
            opts['selftest'] = True
        elif a in ('-h', '--help'):
            sys.stderr.write(__doc__)
            sys.exit(0)
        else:
            positional.append(a)
        i += 1
    if positional:
        opts['input'] = positional[0]
    if len(positional) > 1:
        opts['output'] = positional[1]
    return opts


# ──────────────────────────────────────────────────────────────────────────
# self-test
# ──────────────────────────────────────────────────────────────────────────

# Deliberately unequal on every axis, so the axis permutation is testable —
# a cube would pass a wrong mapping.
BOX = (0.6, 0.4, 1.0)

# Four texel colours, one per quadrant of a 2x2 texture. Blender's pixel rows
# run bottom-up, so index 0 is the bottom-left texel.
QUADS = [(0.2, 0.1, 0.05),      # (0, 0) bottom-left
         (0.8, 0.2, 0.10),      # (1, 0) bottom-right
         (0.1, 0.6, 0.30),      # (0, 1) top-left
         (0.3, 0.4, 0.90)]      # (1, 1) top-right

# Face-corner UVs, each landing dead centre in one quadrant.
CORNER_UV = [(0.25, 0.25), (0.75, 0.25), (0.75, 0.75), (0.25, 0.75)]


def _box_mesh(name, sx, sy, sz):
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0
    verts = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
             (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
    # All six wound counter-clockwise seen from outside.
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
             (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        for k, loop in enumerate(poly.loop_indices):
            uv.data[loop].uv = CORNER_UV[k % 4]
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    return ob, verts


def _test_image():
    image = bpy.data.images.new('quads', 2, 2, alpha=False)
    image.colorspace_settings.name = 'sRGB'
    pixels = []
    for r, g, b in QUADS:
        pixels.extend((r, g, b, 1.0))
    image.pixels = pixels
    try:
        image.pack()
    except Exception:
        pass
    return image


def _textured_material(image):
    mat = bpy.data.materials.new('quadmat')
    mat.use_nodes = True
    tree = mat.node_tree
    principled = next(n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = tree.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Closest'
    tree.links.new(tex.outputs['Color'], principled.inputs['Base Color'])
    return mat


def _flat_material(name, rgb):
    """A base-colour FACTOR and no texture. default_value is scene-linear, so
    the sRGB the bake should produce is srgb() of what goes in here."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    principled = next(n for n in mat.node_tree.nodes
                      if n.type == 'BSDF_PRINCIPLED')
    principled.inputs['Base Color'].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
    return mat


def _roundtrip(tmp):
    """Export the current scene to GLB and import it back, so the self-test
    exercises the real import path rather than a scene we happen to have."""
    bpy.ops.export_scene.gltf(filepath=tmp, export_format='GLB',
                              use_selection=False)
    clear()
    bpy.ops.import_scene.gltf(filepath=tmp)


def _near(a, b, tol=0.02):
    return abs(a - b) <= tol


def selftest():
    failures = []
    scratch = os.environ.get('TMPDIR', '/tmp')

    def check(ok, message):
        if not ok:
            failures.append(message)
        sys.stderr.write('  %s %s\n' % ('ok  ' if ok else 'FAIL', message))

    # ── stage 1: the textured box ─────────────────────────────────────────
    sys.stderr.write('selftest: textured box through a real GLB round trip\n')
    clear()
    image = _test_image()
    ob, verts = _box_mesh('testbox', *BOX)
    ob.data.materials.append(_textured_material(image))
    _roundtrip(os.path.join(scratch, 'bake_glb_selftest.glb'))

    positions, normals, colors, parts = bake()

    check(len(positions) // 9 == 12,
          'triangles: 12 expected, got %d' % (len(positions) // 9))
    check(len(colors) == len(positions),
          'colors parallel to positions (%d vs %d)' % (len(colors), len(positions)))
    check(len(parts) == 1 and parts[0]['start'] == 0
          and parts[0]['count'] == len(positions) // 3,
          'one part covering every vertex')

    # Axis map: every game position must be the mapped Blender position.
    expected = set((round(-x, 3), round(z, 3), round(y, 3)) for x, y, z in verts)
    got = set(tuple(round(positions[i + k], 3) for k in range(3))
              for i in range(0, len(positions), 3))
    check(got == expected,
          'axis map (x,y,z)->(-x,z,y): %d corners, %d match' % (
              len(expected), len(expected & got)))

    lo, hi = bounds_of(positions)
    check(_near(hi[0] - lo[0], BOX[0], 1e-3) and _near(hi[1] - lo[1], BOX[2], 1e-3)
          and _near(hi[2] - lo[2], BOX[1], 1e-3),
          'bounds %.3f x %.3f x %.3f m match the 0.6 x 0.4 x 1.0 box turned Y-up'
          % (hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]))

    # Blender +Z (up) must come out as game +Y (up).
    unique = set(tuple(round(normals[i + k], 2) for k in range(3))
                 for i in range(0, len(normals), 3))
    check((0.0, 1.0, 0.0) in unique and (0.0, -1.0, 0.0) in unique,
          'normals: Blender +/-Z became game +/-Y')

    # Every baked colour is one of the four texels, and all four turned up.
    seen = set()
    stray = None
    for i in range(0, len(colors), 3):
        rgb = colors[i:i + 3]
        hit = None
        for q, quad in enumerate(QUADS):
            if all(_near(rgb[k], quad[k]) for k in range(3)):
                hit = q
                break
        if hit is None:
            stray = rgb
            break
        seen.add(hit)
    check(stray is None, 'every vertex colour is a texel of the test texture'
          + ('' if stray is None else ' (stray %s)' % [round(c, 3) for c in stray]))
    check(len(seen) == 4, 'all four texels were sampled (%d/4)' % len(seen))

    before = orientation(positions, normals)
    report_orientation('  selftest orientation', before)
    check(before['verdict'] == 'outward',
          'an outward-wound box reads as outward')

    flip_inside_out(positions, normals, colors)
    after = orientation(positions, normals)
    report_orientation('  selftest after --flip', after)
    check(after['verdict'] == 'inside-out',
          '--flip turns it inside out, so the check is actually looking')

    flip_inside_out(positions, normals, colors)
    back = orientation(positions, normals)
    check(back['verdict'] == 'outward', 'flipping twice is a no-op')

    scaled = apply_scale(positions, 2.0)
    slo, shi = bounds_of(scaled)
    check(_near(shi[0] - slo[0], BOX[0] * 2, 1e-3),
          '--scale 2 doubles the bounding box')

    # ── stage 2: the two fallbacks ────────────────────────────────────────
    sys.stderr.write('selftest: base-colour factor and no-material fallbacks\n')
    clear()
    linear = (0.25, 0.5, 0.75)
    a, _ = _box_mesh('factorbox', 0.2, 0.2, 0.2)
    a.data.materials.append(_flat_material('flat', linear))
    b, _ = _box_mesh('barebox', 0.2, 0.2, 0.2)
    b.location = (1.0, 0.0, 0.0)
    _roundtrip(os.path.join(scratch, 'bake_glb_selftest2.glb'))

    positions, normals, colors, parts = bake()
    by_name = {}
    for part in parts:
        by_name[part['name'].split(':')[0]] = part

    want = [round(srgb(c), 4) for c in linear]
    part = by_name.get('factorbox')
    check(part is not None and all(_near(part['color'][k], want[k], 0.01)
                                   for k in range(3)),
          'no texture -> sRGB of the base-colour factor %s (got %s)'
          % (want, part['color'] if part else None))

    part = by_name.get('barebox')
    check(part is not None and all(_near(part['color'][k], MID_GREY[k], 0.001)
                                   for k in range(3)),
          'no material -> mid grey (got %s)' % (part['color'] if part else None))

    for tmp in ('bake_glb_selftest.glb', 'bake_glb_selftest2.glb'):
        try:
            os.remove(os.path.join(scratch, tmp))
        except OSError:
            pass

    if failures:
        sys.stderr.write('selftest: %d FAILURE(S)\n' % len(failures))
        for f in failures:
            sys.stderr.write('  - %s\n' % f)
        sys.exit(1)
    sys.stderr.write('selftest: all checks passed\n')


# ──────────────────────────────────────────────────────────────────────────

def main():
    opts = parse_args()
    if opts['selftest'] or not opts['input']:
        selftest()
        return

    in_path = os.path.abspath(opts['input'])
    if not os.path.exists(in_path):
        sys.stderr.write('bake_glb: no such file: %s\n' % in_path)
        sys.exit(1)
    out_path = os.path.abspath(
        opts['output'] or os.path.splitext(in_path)[0] + '.json')
    name = opts['name'] or os.path.splitext(os.path.basename(in_path))[0]

    clear()
    bpy.ops.import_scene.gltf(filepath=in_path)

    positions, normals, colors, parts = bake()
    if not positions:
        sys.stderr.write('bake_glb: %s contained no mesh geometry\n' % in_path)
        sys.exit(1)

    lo, hi = bounds_of(positions)
    sys.stderr.write(
        'bake_glb: imported %.3f x %.3f x %.3f m'
        % (hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]))
    if opts['scale'] != 1.0:
        positions = apply_scale(positions, opts['scale'])
        lo, hi = bounds_of(positions)
        sys.stderr.write(' -> x%g -> %.3f x %.3f x %.3f m'
                         % (opts['scale'], hi[0] - lo[0], hi[1] - lo[1],
                            hi[2] - lo[2]))
    sys.stderr.write('\n')

    report_orientation('bake_glb: orientation', orientation(positions, normals))
    if opts['flip']:
        flip_inside_out(positions, normals, colors)
        report_orientation('bake_glb: after --flip',
                           orientation(positions, normals))

    source = os.path.relpath(in_path, os.getcwd())
    if source.startswith('..'):
        source = in_path
    data, lo, hi = write(out_path, source, name,
                         positions, normals, colors, parts)
    summarise(out_path, data, lo, hi)


main()
