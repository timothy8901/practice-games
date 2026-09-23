/* Dress the game in the Thrixel art from Mote Rumble.
 *
 * The game builds its fighters and arena from code-drawn primitives. This keeps
 * that rig exactly as it is - the animation code drives parts.body, the arm
 * pivots, parts.weapon and so on - and swaps only what those parts look like:
 * the Mote body, its two floating gauntlets, its weapon, and the stone arena.
 * Each ability maps to the Core that was built from it for Mote Rumble.
 *
 * Models load in the background; until they land the game keeps its own look,
 * and the menu holds the fight back rather than starting one half-dressed.
 */
(() => {
  'use strict';
  const CORE = { sword: 'blade', beam: 'arc', cutter: 'disc', hammer: 'maul',
                 archer: 'bow', fire: 'flare', bomb: 'cinder', parasol: 'veil' };
  const BASE = 'models/';
  const BODY_HEIGHT = 2.15;   // a little taller than the sphere it replaces: darker art, small screen
  const HAND_SIZE = 0.9;
  // Weapons hang from the right hand the way the old ones did. "end" grips are
  // held at the butt of the shaft; "middle" ones sit in the fist. Lengths and the
  // resting tilt keep the tip off the stage - the hand is only 1.02 above it.
  const WEAPONS = {
    blade:  { length: 1.6, grip: 'end', tilt: -0.45 },
    arc:    { length: 1.7, grip: 'end', tilt: -0.5 },
    disc:   { length: 0.95, grip: 'middle', keepAxis: true },
    maul:   { length: 1.4, grip: 'end', tilt: -0.4 },
    bow:    { length: 1.7, grip: 'middle' },
    flare:  null,            // fire breathes flame; the molten fist is its gauntlet
    cinder: { length: 0.75, grip: 'middle' },
    veil:   { length: 1.5, grip: 'end', tilt: -0.32 },
  };
  // Background: the same floating islands, crystals and broken columns as Mote Rumble.
  const SCENERY = { sky_island: { size: 8.5, anchor: 'top' },
                    crystal_cluster: { size: 2.4, anchor: 'bottom' },
                    ruined_pillar: { size: 3.2, anchor: 'bottom' } };

  const art = { ready: false, failed: false, geo: {}, mat: {}, arena: null };
  const bounds = (geo) => {
    geo.computeBoundingBox();
    const size = new THREE.Vector3(), mid = new THREE.Vector3();
    geo.boundingBox.getSize(size);
    geo.boundingBox.getCenter(mid);
    return { box: geo.boundingBox, size, mid };
  };

  function shape(model, role, core) {
    const geo = model.geometry.clone();
    let b = bounds(geo);
    if (SCENERY[role]) {
      const spec = SCENERY[role];
      const scale = spec.size / Math.max(b.size.x, b.size.y, b.size.z);
      geo.translate(-b.mid.x, 0, -b.mid.z);
      geo.scale(scale, scale, scale);
      b = bounds(geo);
      geo.translate(0, spec.anchor === 'top' ? -b.box.max.y : -b.box.min.y, 0);
    } else if (role === 'body' || role === 'gauntlet') {
      const scale = role === 'body' ? BODY_HEIGHT / b.size.y
                                    : HAND_SIZE / Math.max(b.size.x, b.size.y, b.size.z);
      geo.translate(-b.mid.x, -b.mid.y, -b.mid.z);
      geo.scale(scale, scale, scale);
      if (role === 'body') geo.translate(0, 0.07, 0);   // the Motes hover
    } else {
      const spec = WEAPONS[core];
      if (!spec.keepAxis) {
        // stand the long side up, so "down from the hand" is one rotation away
        if (b.size.x > b.size.y && b.size.x >= b.size.z) geo.rotateZ(Math.PI / 2);
        else if (b.size.z > b.size.y) geo.rotateX(-Math.PI / 2);
        b = bounds(geo);
      }
      const scale = spec.length / Math.max(b.size.x, b.size.y, b.size.z);
      geo.scale(scale, scale, scale);
      b = bounds(geo);
      if (spec.grip === 'end') {
        geo.translate(-b.mid.x, -b.box.min.y, -b.mid.z);   // grip at the hand
        geo.rotateX(Math.PI);                              // hanging down
      } else {
        geo.translate(-b.mid.x, -b.mid.y, -b.mid.z);
      }
    }
    bounds(geo);
    geo.computeBoundingSphere();
    return geo;
  }

  async function loadArt() {
    const jobs = [];
    for (const core of Object.values(CORE)) {
      jobs.push(['body', core], ['gauntlet', core]);
      if (WEAPONS[core]) jobs.push(['weapon', core]);
    }
    for (const name of Object.keys(SCENERY)) jobs.push([name, name]);
    await Promise.all(jobs.map(async ([role, core]) => {
      const key = SCENERY[role] ? role : core + '_' + role;
      const model = await BKRModels.load(BASE + key + '.glb');
      art.geo[key] = shape(model, role, core);
      art.mat[key] = model.material;
    }));
    art.arena = await BKRModels.load(BASE + 'arena.glb');
    art.ready = true;
  }

  // ------------------------------------------------------------- fighters
  const buildOriginal = window.buildFighter;
  window.buildFighter = function (palette, abilityKey) {
    const built = buildOriginal(palette, abilityKey);
    if (!art.ready) return built;
    const { group, parts } = built;
    const core = CORE[abilityKey];
    const dress = (mesh, key) => {
      mesh.geometry = art.geo[key];
      mesh.material = art.mat[key].clone();   // per fighter: the hit flash tints it
      mesh.castShadow = true;
      return mesh;
    };

    dress(parts.body, core + '_body');

    // The knights are limbless: no feet, no face decorations, no ability hat.
    parts.footL.visible = parts.footR.visible = false;
    parts.hat.visible = false;
    const rig = new Set([parts.body, parts.footL, parts.footR, parts.bubble, parts.bubbleRing, parts.tele]);
    for (const child of group.children) if (child.isMesh && !rig.has(child)) child.visible = false;

    for (const [pivot, flip] of [[parts.armL, -1], [parts.armR, 1]]) {
      const hand = dress(pivot.children[0], core + '_gauntlet');
      hand.rotation.set(0, flip < 0 ? Math.PI : 0, 0);
      pivot.position.set(flip * 1.18, 1.05, 0.14);
    }

    for (const old of parts.weapon.children.slice()) parts.weapon.remove(old);
    if (WEAPONS[core]) {
      const weapon = new THREE.Mesh(art.geo[core + '_weapon'], art.mat[core + '_weapon'].clone());
      weapon.castShadow = true;
      weapon.position.set(0, 0, 0.25);
      weapon.rotation.x = WEAPONS[core].tilt || 0;   // resting angle; the game rotates the group, not this
      parts.weapon.add(weapon);
    }
    return built;
  };

  // ---------------------------------------------------------------- arena
  function dressArena() {
    // Hide the code-drawn stage: everything already in the scene except the sky
    // dome, the floating decor and the lights. Fighters are built later.
    const decorSet = new Set(decor);
    for (const object of scene.children) {
      if (!object.isMesh || decorSet.has(object)) continue;
      const sky = object.material && object.material.side === THREE.BackSide;
      if (!sky) object.visible = false;
    }
    const { geometry, material, extras } = art.arena;
    const stage = new THREE.Mesh(geometry, material);
    material.color.setRGB(0.7, 0.71, 0.8);   // the raw stone reads bone-white under these lights
    const scale = ARENA_R / extras.deckR;              // the deck's edge is the arena's edge
    stage.scale.setScalar(scale);
    stage.position.y = -extras.deckY * scale;          // and its top surface is the floor
    stage.receiveShadow = true;
    stage.castShadow = true;
    scene.add(stage);
    duskLight();
    dressScenery();
  }

  function duskLight() {
    // Mote Rumble's dusk, so the stone reads as stone instead of bleaching out.
    // Filmic tone mapping matters most: without it the bright stone clips to white.
    if (THREE.ACESFilmicToneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.78;
      scene.traverse((o) => { if (o.isMesh && o.material) o.material.needsUpdate = true; });
    }
    const sky = scene.children.find((o) => o.isMesh && o.material && o.material.side === THREE.BackSide);
    if (sky && sky.geometry.attributes.color) {
      const high = new THREE.Color(0x2e2b4a), low = new THREE.Color(0x8e7f96), mix = new THREE.Color();
      const position = sky.geometry.attributes.position, colors = sky.geometry.attributes.color;
      for (let i = 0; i < position.count; i++) {
        const t = THREE.MathUtils.clamp((position.getY(i) / 70) * 0.5 + 0.5, 0, 1);
        mix.copy(low).lerp(high, Math.pow(t, 0.8));
        colors.setXYZ(i, mix.r, mix.g, mix.b);
      }
      colors.needsUpdate = true;
    }
    scene.fog.color.setHex(0x7d7189);
    scene.fog.near = 34; scene.fog.far = 76;
    if (scene.background && scene.background.setHex) scene.background.setHex(0x7d7189);
    for (const light of scene.children) {
      if (light.isHemisphereLight) { light.intensity = 0.4; light.color.setHex(0xcfd8ff); light.groundColor.setHex(0xb08a7a); }
      else if (light.isAmbientLight) { light.intensity = 0.15; light.color.setHex(0xe8dcff); }
    }
    sun.intensity = 0.85; sun.color.setHex(0xffe9cf);
    fill.intensity = 0.25; fill.color.setHex(0x9fb6ff);
    rim.intensity = 0.3;
  }

  function dressScenery() {
    // Swap the blocky clouds and stars for Mote Rumble's floating islands. The game's
    // own decor loop animates whatever sits in `decor`, so reuse its orbit/bob data.
    for (const old of decor) scene.remove(old);
    decor.length = 0;
    const put = (key, parent, y) => {
      const mesh = new THREE.Mesh(art.geo[key], art.mat[key]);
      mesh.position.y = y || 0;
      parent.add(mesh);
      return mesh;
    };
    for (let i = 0; i < 4; i++) {
      const island = new THREE.Group();
      put('sky_island', island);
      put(i % 2 ? 'crystal_cluster' : 'ruined_pillar', island, -0.1);
      const angle = i / 4 * Math.PI * 2 + 0.6;
      island.position.set(Math.cos(angle) * 19, 4.2 + (i % 2) * 2.6, Math.sin(angle) * 19);
      island.rotation.y = i * 1.1;
      island.userData.orbit = { a: angle, speed: 0.018 + i * 0.004, r: 19, y: island.position.y };
      decor.push(island);
      scene.add(island);
    }
    for (let i = 0; i < 4; i++) {
      const crystal = new THREE.Mesh(art.geo.crystal_cluster, art.mat.crystal_cluster);
      crystal.scale.setScalar(0.7);
      const angle = i / 4 * Math.PI * 2 + 1.9;
      crystal.position.set(Math.cos(angle) * 14.5, 3.4 + (i % 3) * 1.2, Math.sin(angle) * 14.5);
      crystal.userData.bob = { y: crystal.position.y, ph: i * 1.3 };
      decor.push(crystal);
      scene.add(crystal);
    }
  }

  // --------------------------------------------------------------- gating
  // Don't start a fight in half the art: hold the pick until the models land.
  const startOriginal = window.beginMatch;
  let pending = false;
  window.beginMatch = function () {
    if (!art.ready && !art.failed) {
      pending = true;
      const card = overlayEl.querySelector('.overlay-card');
      if (card && !card.querySelector('.bkr-loading')) {
        card.insertAdjacentHTML('beforeend', '<div class="overlay-sub bkr-loading">Loading fighters…</div>');
      }
      return;
    }
    startOriginal();
  };

  loadArt().then(() => {
    dressArena();
    console.log('[BKR] Thrixel art ready');
    if (pending) { pending = false; beginMatch(); }
    else if (game.phase !== 'fight') renderOverlay();
  }).catch((err) => {
    console.error('[BKR] Thrixel art failed, keeping the built-in look: ' + err.message);
    art.failed = true;
    if (pending) { pending = false; startOriginal(); }
    else if (game.phase !== 'fight') renderOverlay();
  });
})();
