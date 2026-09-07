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
