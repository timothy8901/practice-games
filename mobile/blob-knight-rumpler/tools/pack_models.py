#!/usr/bin/env python3
"""Shrink the Thrixel GLBs into phone-sized models for the web build.

    python3 tools/pack_models.py [--out DIR] [--src DIR]

Each source model is one mesh with a 2048x2048 PBR texture set, about 10 MB.
This merges its primitives, makes the winding face outward (three.js and glTF
agree on handedness; Unreal does not, which is why some files on disk are
flipped for Unreal's benefit), rescales the base colour texture to a JPEG, and
writes a minimal GLB - positions, normals, UVs, indices, one texture - that
web/models.js can parse without a full glTF loader. About 250 KB each.

Measurements the game needs (bounding box, and for the arena the deck's height
and radius) are written into the GLB's `extras`, so the game never guesses.
"""
import argparse
import io
import json
import os
import struct
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(REPO, 'thrixel_assets', 'mote_rumble')

CORES = ['blade', 'arc', 'disc', 'maul', 'bow', 'flare', 'cinder', 'veil']
COMPONENT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NUM = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read_glb(path):
    data = open(path, 'rb').read()
    if data[:4] != b'glTF':
        sys.exit('not a GLB: ' + path)
    off, js, bin_ = 12, None, None
    while off < len(data):
        length, ctype = struct.unpack('<II', data[off:off + 8])
        chunk = data[off + 8:off + 8 + length]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk)
        elif ctype == 0x004E4942:
            bin_ = chunk
        off += 8 + length
    return js, bin_


def accessor(js, bin_, index):
    a = js['accessors'][index]
    view = js['bufferViews'][a['bufferView']]
    dtype, n = COMPONENT[a['componentType']], NUM[a['type']]
    start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = view.get('byteStride', 0)
    item = np.dtype(dtype).itemsize * n
    if stride and stride != item:
        raw = np.frombuffer(bin_, dtype=np.uint8, count=stride * a['count'], offset=start).reshape(a['count'], stride)
        return np.frombuffer(raw[:, :item].tobytes(), dtype=dtype).reshape(a['count'], n)
    return np.frombuffer(bin_, dtype=dtype, count=a['count'] * n, offset=start).reshape(a['count'], n).copy()


def node_transform(js, node_index, out, parent=np.eye(4)):
    """glTF nodes can carry a transform; bake it into the vertices."""
    node = js['nodes'][node_index]
    m = np.eye(4)
    if 'matrix' in node:
        m = np.array(node['matrix'], dtype=np.float64).reshape(4, 4).T
    else:
        if 'scale' in node:
            m[:3, :3] = np.diag(node['scale'])
        if 'rotation' in node:
            x, y, z, w = node['rotation']
            r = np.array([
                [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
            m[:3, :3] = r @ m[:3, :3]
        if 'translation' in node:
            m[:3, 3] = node['translation']
    world = parent @ m
    if 'mesh' in node:
        out.append((node['mesh'], world))
    for child in node.get('children', []):
        node_transform(js, child, out, world)


def merge(js, bin_):
    """Every primitive in the file as one set of arrays, node transforms baked in."""
    meshes = []
    scene = js.get('scenes', [{}])[js.get('scene', 0)]
    for root in scene.get('nodes', range(len(js.get('nodes', [])))):
        node_transform(js, root, meshes)
    if not meshes:
        meshes = [(i, np.eye(4)) for i in range(len(js['meshes']))]

    pos, nor, uv, idx = [], [], [], []
    base = 0
    for mesh_index, world in meshes:
        normal_matrix = np.linalg.inv(world[:3, :3]).T
        for prim in js['meshes'][mesh_index]['primitives']:
            attrs = prim['attributes']
            p = accessor(js, bin_, attrs['POSITION']).astype(np.float32)
            p = (world[:3, :3] @ p.T).T + world[:3, 3]
            n = (accessor(js, bin_, attrs['NORMAL']).astype(np.float32) if 'NORMAL' in attrs
                 else np.zeros_like(p))
            n = (normal_matrix @ n.T).T
            t = (accessor(js, bin_, attrs['TEXCOORD_0']).astype(np.float32) if 'TEXCOORD_0' in attrs
                 else np.zeros((len(p), 2), np.float32))
            i = (accessor(js, bin_, prim['indices']).reshape(-1) if 'indices' in prim
                 else np.arange(len(p)))
            pos.append(p.astype(np.float32))
            nor.append(n.astype(np.float32))
            uv.append(t.astype(np.float32))
            idx.append(i.astype(np.uint32) + base)
            base += len(p)
    return (np.concatenate(pos), np.concatenate(nor), np.concatenate(uv), np.concatenate(idx))


def face_outward(pos, nor, idx):
    """Flip the winding if the mesh is inside out (negative enclosed volume)."""
    tri = idx.reshape(-1, 3)
    a, b, c = pos[tri[:, 0]].astype(np.float64), pos[tri[:, 1]].astype(np.float64), pos[tri[:, 2]].astype(np.float64)
    volume = np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6.0
    if volume >= 0:
        return idx, nor, False
    return tri[:, ::-1].reshape(-1).copy(), (-nor), True


def deck_of(pos, nor, idx):
    """Highest broad horizontal surface: (height, radius). Used to seat the arena."""
    tri = idx.reshape(-1, 3)
    a, b, c = pos[tri[:, 0]].astype(np.float64), pos[tri[:, 1]].astype(np.float64), pos[tri[:, 2]].astype(np.float64)
    cross = np.cross(b - a, c - a)
    length = np.linalg.norm(cross, axis=1)
    flat = (length > 1e-12) & (np.abs(cross[:, 1]) / np.maximum(length, 1e-12) > 0.98)
    if not flat.any():
        return None
    area = length[flat] * 0.5
    height = np.round(((a[flat, 1] + b[flat, 1] + c[flat, 1]) / 3.0) * 200) / 200
    buckets = {}
    for h, ar in zip(height, area):
        buckets[h] = buckets.get(h, 0.0) + ar
    broadest = max(buckets.values())
    deck_y = max(h for h, ar in buckets.items() if ar >= 0.5 * broadest)
    on_deck = flat.copy()
    on_deck[flat] = np.abs(height - deck_y) < 0.02
    verts = np.unique(tri[on_deck].reshape(-1))
    radius = float(np.max(np.hypot(pos[verts, 0], pos[verts, 2]))) if len(verts) else 0.0
    return float(deck_y), radius


def base_colour_image(js, bin_):
    mat = (js.get('materials') or [{}])[0]
    pbr = mat.get('pbrMetallicRoughness', {})
    tex_index = pbr.get('baseColorTexture', {}).get('index')
    if tex_index is None:
        return None, pbr.get('baseColorFactor', [1, 1, 1, 1])
    source = js['textures'][tex_index]['source']
    view = js['bufferViews'][js['images'][source]['bufferView']]
    start = view.get('byteOffset', 0)
    raw = bin_[start:start + view['byteLength']]
    return Image.open(io.BytesIO(raw)).convert('RGB'), pbr.get('baseColorFactor', [1, 1, 1, 1])


def pad4(data, filler=b'\x00'):
    return data + filler * (-len(data) % 4)


def write_glb(path, pos, nor, uv, idx, jpeg, factor, extras):
    index_dtype, index_type = (np.uint16, 5123) if len(pos) < 65536 else (np.uint32, 5125)
    idx = idx.astype(index_dtype)
    blobs = [idx.tobytes(), pos.astype(np.float32).tobytes(), nor.astype(np.float32).tobytes(),
             uv.astype(np.float32).tobytes(), jpeg or b'']
    views, offset = [], 0
    for blob in blobs:
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(blob)})
        offset += len(pad4(blob))
    js = {
        'asset': {'version': '2.0', 'generator': 'pack_models.py (Blob Knight Rumpler)'},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 1, 'NORMAL': 2, 'TEXCOORD_0': 3},
                                    'indices': 0, 'material': 0}], 'extras': extras}],
        'accessors': [
            {'bufferView': 0, 'componentType': index_type, 'count': int(len(idx)), 'type': 'SCALAR'},
            {'bufferView': 1, 'componentType': 5126, 'count': int(len(pos)), 'type': 'VEC3',
             'min': [float(v) for v in pos.min(axis=0)], 'max': [float(v) for v in pos.max(axis=0)]},
            {'bufferView': 2, 'componentType': 5126, 'count': int(len(nor)), 'type': 'VEC3'},
            {'bufferView': 3, 'componentType': 5126, 'count': int(len(uv)), 'type': 'VEC2'},
        ],
        'bufferViews': views[:4] + ([views[4]] if jpeg else []),
        'buffers': [{'byteLength': offset}],
        'materials': [{'pbrMetallicRoughness': {'baseColorFactor': factor,
                                                **({'baseColorTexture': {'index': 0}} if jpeg else {})},
                       'doubleSided': False}],
        'extras': extras,
    }
    if jpeg:
        js['images'] = [{'bufferView': 4, 'mimeType': 'image/jpeg'}]
        js['textures'] = [{'source': 0}]
    json_chunk = pad4(json.dumps(js, separators=(',', ':')).encode(), b' ')   # glTF: JSON pads with spaces, BIN with zeros
    bin_chunk = b''.join(pad4(b) for b in blobs)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(json_chunk) + 8 + len(bin_chunk))
    out += struct.pack('<II', len(json_chunk), 0x4E4F534A) + json_chunk
    out += struct.pack('<II', len(bin_chunk), 0x004E4942) + bin_chunk
    open(path, 'wb').write(out)
    return len(out)


def pack(src, dst, texture_px, quality=84, arena=False):
    js, bin_ = read_glb(src)
    pos, nor, uv, idx = merge(js, bin_)
    idx, nor, flipped = face_outward(pos, nor, idx)
    image, factor = base_colour_image(js, bin_)
    jpeg = b''
    if image is not None:
        buf = io.BytesIO()
        image.resize((texture_px, texture_px), Image.LANCZOS).save(buf, 'JPEG', quality=quality, optimize=True)
        jpeg = buf.getvalue()
    low, high = pos.min(axis=0), pos.max(axis=0)
    extras = {'min': [float(v) for v in low], 'max': [float(v) for v in high]}
    if arena:
        deck = deck_of(pos, nor, idx)
        if not deck:
            sys.exit('no flat deck found in ' + src)
        extras['deckY'], extras['deckR'] = deck
    size = write_glb(dst, pos, nor, uv, idx, jpeg, factor, extras)
    print('  %-22s %5d tris  %6.0f KB  %s%s' % (
        os.path.basename(dst), len(idx) // 3, size / 1024,
        'flipped  ' if flipped else '',
        'deck y=%.3f r=%.3f' % (extras['deckY'], extras['deckR']) if arena else ''))
    return size


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--src', default=SRC, help='thrixel_assets/mote_rumble')
    ap.add_argument('--out', default=os.path.join(HERE, 'models'))
    ap.add_argument('--texture', type=int, default=512, help='texture size for the Mote bodies')
    ap.add_argument('--prop-texture', type=int, default=256, help='texture size for gauntlets and weapons')
    ap.add_argument('--arena-texture', type=int, default=1024)
    args = ap.parse_args()
    if not os.path.isdir(args.src):
        sys.exit('no Thrixel models at %s - they are not in git; regenerate or copy them there' % args.src)
    os.makedirs(args.out, exist_ok=True)

    total = 0
    print('bodies at %dpx, gauntlets and weapons at %dpx:' % (args.texture, args.prop_texture))
    for core in CORES:
        for kind, folder in (('body', 'fighters'), ('gauntlet', 'fighters'), ('weapon', 'weapons')):
            src = os.path.join(args.src, folder, '%s_%s.glb' % (core, kind))
            if not os.path.exists(src):
                sys.exit('missing ' + src)
            # flare_weapon.glb is the same molten fist as its gauntlet - fire has no
            # weapon in the game, so skip it rather than ship the file twice.
            if core == 'flare' and kind == 'weapon':
                continue
            px = args.texture if kind == 'body' else args.prop_texture
            total += pack(src, os.path.join(args.out, '%s_%s.glb' % (core, kind)), px)
    total += pack(os.path.join(args.src, 'weapons', 'bow_arrow.glb'),
                  os.path.join(args.out, 'bow_arrow.glb'), args.prop_texture)
    print('arena (%dpx texture):' % args.arena_texture)
    total += pack(os.path.join(args.src, 'arena', 'arena_platform_v2.glb'),
                  os.path.join(args.out, 'arena.glb'), args.arena_texture, arena=True)
    print('scenery (%dpx textures):' % args.prop_texture)
    for name in ('sky_island', 'crystal_cluster', 'ruined_pillar'):
        total += pack(os.path.join(args.src, 'arena', '%s.glb' % name),
                      os.path.join(args.out, '%s.glb' % name), args.prop_texture)
    print('total %.1f MB in %s' % (total / 1e6, os.path.relpath(args.out, HERE)))


if __name__ == '__main__':
    main()
