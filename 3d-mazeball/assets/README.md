# Baked assets

## `doll.json` — the man in the suit

Modelled in Blender, baked to JSON, committed. The game fetches it at startup
and hands it straight to a render group; nothing at runtime needs Blender.

Rebuild after editing `build_character.py`:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python 3d-mazeball/assets/build_character.py
```

Add `-- --preview` to also render four Workbench turnaround stills next to the
JSON. They are gitignored — they exist to check proportions, not to ship.

### Why this one asset comes out of Blender

Everything else in the kit is hand-written primitives, and that is the right
call for a maze: it stays deterministic, it costs nothing, and collision comes
out of the same mesher pass as the geometry. A character is the opposite case.
The MySims look is *subdivision* — no hard edge anywhere — and subdivision
surfaces plus bevels are what a modeller gives you and what hand-rolled boxes
cannot.

### Format

| field | meaning |
| --- | --- |
| `positions`, `normals` | flat `[x, y, z, …]`, game axes (Y up), metres |
| `parts` | `{name, color, start, count}` runs over the vertex arrays |
| `bounds` | `lo` / `hi` corners, after vertical recentring |
| `triangles`, `blender` | provenance, shown in the review page's toolbar |

Colour is stored once per part rather than per vertex — 23 parts against ~23,000
vertices, so the run encoding is about a third of the file. The loader in
`review/severed.js` expands the runs into the colour buffer.

### Two things that will bite

**Normals are smooth.** This is the only geometry in the project that is not
flat-shaded. `review/gl.js` takes whatever normals a group hands it, so the
subdivided character and the faceted architecture coexist without a branch — but
do not "fix" the exporter to emit face normals.

**He faces −Z.** `ballMatrix()` in `review/severed.js` yaws by heading + π on the
basis that the model faces local −Z. Blender models face −Y, and the axis map in
`export()` accounts for the difference. Exported the naive way he runs down the
corridor backwards.

## `desk.json` — the MDR workstation

Generated in Thrixel, reduced, then baked to vertex colours by `bake_glb.py`.
The intermediate GLB lives under `thrixel_assets/`, which this repo gitignores,
so only the bake is committed. To regenerate it:

| step | what |
| --- | --- |
| prompt | "A plain white office desk with a boxy beige 1980s CRT computer terminal and a chunky keyboard on it." |
| tool | `thrixel_create_model` (hard-surface, multi-part) |
| submission | `8c1fcbc0-abb0-429a-a10f-3056978878da` — 24,536 tris |
| reduce | `thrixel_reduce_triangles` to 3,000 → `eb1eb429-033d-42f2-ba1f-af85713c6031` (free, keeps the texture) |
| bake | `bake_glb.py ... --scale 0.8` → 2,996 tris, 1.60 × 1.21 × 0.82 m |

### Why the bake exists at all

Thrixel ships GLB with PBR textures. `review/gl.js` has **no texture support** —
no UVs, no samplers, nothing. Rather than grow a texture path through a
deliberately dependency-free renderer, `bake_glb.py` samples each vertex's
base-colour texel at build time and writes the same `{positions, normals,
colors}` every other render group already is. Nothing at runtime knows Thrixel
exists.

### Check the winding

Thrixel models on this account have a history of arriving inside out, with
winding and stored normals agreeing with each other while both point inward —
so comparing the two catches nothing. `bake_glb.py` runs a world-space test
instead and prints the verdict; pass `--flip` when it says INWARD. This desk
came back `OUTWARD (signed volume +0.12246 m3 [closed])`, so no flip was needed.
Do not skip reading that line: the failure is silent and looks like bad lighting.
