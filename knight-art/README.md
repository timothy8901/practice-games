# Knight art

The 3D models Blob Knight Rumpler is played with: the eight cores' bodies,
gauntlets and weapons, the stone arena, and the sky islands, crystals and
columns around it - 28 GLBs, about 10 MB. They come from the Mote Rumble
project in Thrixel.

The game page loads them from here - `blob-knight-rumpler.html` carries the
reader and the layer that dresses the fighters - and the Android build copies
this folder into the app, so the site and the phone wear the same art.

They are packed, not raw: `mobile/blob-knight-rumpler/tools/pack_models.py`
merges each Thrixel model's parts, faces its winding outward, shrinks the 2048px
textures, and writes the measurements the game seats them by into each file.
Re-run it after changing the art. The raw Thrixel downloads it reads live in
`thrixel_assets/`, which is not in git.
