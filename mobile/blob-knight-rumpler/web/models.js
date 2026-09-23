/* Loader for the models tools/pack_models.py writes.
 *
 * three.js r152 ships no classic-script GLTFLoader, and the packed files are a
 * fixed, tiny subset of glTF - one mesh, one material, POSITION/NORMAL/UV plus
 * indices, one JPEG - so reading them directly is a few lines and costs no
 * extra download. Returns { geometry, material, extras } per URL, cached.
 */
const BKRModels = (() => {
  'use strict';
  const TYPED = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const ITEMS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const cache = new Map();

  function split(buffer) {
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB');
    let offset = 12, json = null, bin = null;
    while (offset < view.byteLength) {
      const length = view.getUint32(offset, true), kind = view.getUint32(offset + 4, true);
      if (kind === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset + 8, length)));
      else if (kind === 0x004E4942) bin = { buffer, start: offset + 8 };
      offset += 8 + length;
    }
    if (!json || !bin) throw new Error('GLB missing a chunk');
    return { json, bin };
  }

  function read(json, bin, index) {
    const acc = json.accessors[index], view = json.bufferViews[acc.bufferView];
    const Type = TYPED[acc.componentType];
    return new Type(bin.buffer, bin.start + (view.byteOffset || 0), acc.count * ITEMS[acc.type]);
  }

  async function texture(json, bin, index) {
    const image = json.images[json.textures[index].source];
    const view = json.bufferViews[image.bufferView];
    const bytes = new Uint8Array(bin.buffer, bin.start + (view.byteOffset || 0), view.byteLength);
    const bitmap = await createImageBitmap(new Blob([bytes], { type: image.mimeType || 'image/jpeg' }));
    const tex = new THREE.Texture(bitmap);
    tex.flipY = false;                       // glTF UVs start at the top left
    if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  async function fetchModel(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
    const { json, bin } = split(await res.arrayBuffer());
    const prim = json.meshes[0].primitives[0];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(read(json, bin, prim.attributes.POSITION), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(read(json, bin, prim.attributes.NORMAL), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(read(json, bin, prim.attributes.TEXCOORD_0), 2));
    geometry.setIndex(new THREE.BufferAttribute(read(json, bin, prim.indices), 1));
    geometry.computeBoundingBox();

    const pbr = (json.materials[prim.material] || {}).pbrMetallicRoughness || {};
    const options = { shininess: 12, specular: 0x1b1b22 };
    const factor = pbr.baseColorFactor;
    if (factor) options.color = new THREE.Color(factor[0], factor[1], factor[2]);
    if (pbr.baseColorTexture) options.map = await texture(json, bin, pbr.baseColorTexture.index);
    return { geometry, material: new THREE.MeshPhongMaterial(options), extras: json.extras || {} };
  }

  return {
    load(url) {
      if (!cache.has(url)) cache.set(url, fetchModel(url));
      return cache.get(url);
    },
    all(urls) { return Promise.all(urls.map((u) => this.load(u))); },
  };
})();
