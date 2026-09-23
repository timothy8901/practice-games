#!/usr/bin/env python3
"""
Flip a GLB inside out: reverse triangle winding and negate normals.

Some of the sculpted arena pieces come out of the generator with their surfaces
facing the wrong way. They still render (the materials are two-sided) but they
light as if the sun were underneath them, which left the arena deck pitch black
from above no matter where the sun was.

    python3 Tools/flip_glb_normals.py in.glb out.glb
"""

import json
import struct
import sys

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, total = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        raise ValueError("not a GLB: {}".format(path))
    gltf, binary, offset = None, None, 12
    while offset < total:
        length, kind = struct.unpack("<II", data[offset:offset + 8])
        chunk = data[offset + 8: offset + 8 + length]
        if kind == JSON_CHUNK:
            gltf = json.loads(chunk)
        elif kind == BIN_CHUNK:
            binary = bytearray(chunk)
        offset += 8 + length + (-length % 4)
    if gltf is None or binary is None:
        raise ValueError("GLB missing a chunk")
    return gltf, binary


def write_glb(path, gltf, binary):
    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    js += b" " * (-len(js) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), JSON_CHUNK))
        f.write(js)
        f.write(struct.pack("<II", len(binary), BIN_CHUNK))
        f.write(binary)


def view_span(gltf, accessor):
    """Byte offset and element count for a tightly packed accessor."""
    view = gltf["bufferViews"][accessor["bufferView"]]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    return start, accessor["count"], view.get("byteStride")


INDEX_FORMAT = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4)}


def flip(in_path, out_path):
    gltf, binary = read_glb(in_path)
    flipped_indices = set()
    flipped_normals = set()

    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            # --- winding ---
            idx = prim.get("indices")
            if idx is not None and idx not in flipped_indices:
                accessor = gltf["accessors"][idx]
                fmt, size = INDEX_FORMAT[accessor["componentType"]]
                start, count, stride = view_span(gltf, accessor)
                if stride in (None, size):
                    values = list(struct.unpack_from("<{}{}".format(count, fmt), binary, start))
                    for i in range(0, count - 2, 3):
                        values[i + 1], values[i + 2] = values[i + 2], values[i + 1]
                    struct.pack_into("<{}{}".format(count, fmt), binary, start, *values)
                    flipped_indices.add(idx)

            # --- normals ---
            nrm = prim.get("attributes", {}).get("NORMAL")
            if nrm is not None and nrm not in flipped_normals:
                accessor = gltf["accessors"][nrm]
                if accessor["componentType"] == 5126 and accessor["type"] == "VEC3":
                    start, count, stride = view_span(gltf, accessor)
                    step = stride or 12
                    for i in range(count):
                        at = start + i * step
                        x, y, z = struct.unpack_from("<3f", binary, at)
                        struct.pack_into("<3f", binary, at, -x, -y, -z)
                    flipped_normals.add(nrm)

    write_glb(out_path, gltf, binary)
    print("flipped {} index set(s) and {} normal set(s) -> {}".format(
        len(flipped_indices), len(flipped_normals), out_path))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    flip(sys.argv[1], sys.argv[2])
