// js/art/chars/cast.js  [ART-CHARS]
// Who is who: GDD-00 §10 names and species, the body each one wears and the
// palette and portrait ids. Ids are kebab-case (ARCHITECTURE rule 3) and match
// js/art/portraits.js. `gait` tells the renderer how the walk frames move the
// figure: 'walk' | 'glide' (Hesper) | 'fly' (Ludo) | 'hover' (Dimity) | 'hop' (the Thatch).

const c = (name, species, body, extra = {}) => ({ name, species, body, palette: extra.palette || null, gait: 'walk', ...extra });

/** @type {Record<string, {name: string, species: string, body: string, palette: string, portrait: string|null, gait: string, role?: string}>} */
const RAW = {
  // the player's default look is built by player.js from the lease card; this
  // row is the fallback preview (red panda, Ember fur, jumper)
  player: c('Sorrel', 'red panda', 'player', { role: 'player', portrait: null }),

  wren: c('Wren Hearthwright', 'beaver', 'wren', { role: 'resident' }),
  ambrose: c('Ambrose Hearthwright', 'old beaver', 'ambrose', { role: 'resident' }),
  hesper: c('Hesper Coil', 'garden snail', 'snail', { role: 'resident', gait: 'glide' }),
  juniper: c('Juniper Pell', 'magpie', 'magpie', { role: 'resident' }),
  ludo: c('Ludo', 'fruit bat', 'bat', { role: 'resident', gait: 'fly' }),
  barnaby: c('Barnaby Thole', 'hermit crab', 'crab', { role: 'resident' }),
  dimity: c('Dimity', 'rosy maple moth', 'moth', { role: 'resident', gait: 'hover' }),
  augusta: c('Augusta Skerry', 'grey seal', 'augusta', { role: 'resident' }),
  ansel: c('Ansel Stalk', 'grey heron', 'heron', { role: 'resident' }),
  wick: c('Wick Dorrow', 'puffling', 'puffling', { role: 'resident' }),
  tully: c('Tully', 'wombat', 'tully', { role: 'resident' }),
  odile: c('Odile', 'roseate spoonbill', 'spoonbill', { role: 'resident' }),
  bryony: c('Bryony', 'rock hyrax', 'bryony', { role: 'resident' }),
  thessaly: c('Thessaly', 'bilby', 'thessaly', { role: 'resident' }),
  tamsin: c('Tamsin Brack', 'badger', 'tamsin', { role: 'resident' }),
  isolde: c('Isolde Petrel', 'storm petrel', 'isolde', { role: 'letters' }),
  thatch: c('The Thatch', 'finches', 'finches', { role: 'resident', gait: 'hop' }),
  corin: c('Corin Vale', 'tawny owl', 'corin', { role: 'resident' }),
  linnet: c('Linnet Rask', 'stoat', 'linnet', { role: 'resident' }),
  'linnet-ermine': c('Linnet Rask', 'stoat (ermine)', 'linnet', { role: 'resident', palette: 'linnet-ermine', portrait: 'linnet' }),
  pip: c('Pip', 'water rat', 'pip', { role: 'isle' }),

  maud: c('Maud Tallis', 'greylag goose', 'maud', { role: 'spire' }),
  osric: c('Osric Penhallow', 'tortoise', 'osric', { role: 'spire' }),
  ines: c('Ines Calloway', 'crested newt', 'ines', { role: 'spire' }),
  wendel: c('Wendel Teague', 'great crested grebe', 'wendel', { role: 'spire' }),
  ada: c('Ada Halloran', 'jackdaw', 'ada', { role: 'spire' }),
  ivo: c('Ivo Halloran', 'jackdaw', 'ivo', { role: 'spire' }),
  seraphine: c('Seraphine Locke', 'arctic fox', 'seraphine', { role: 'spire' }),
  hollis: c('Hollis Brandt', 'mountain goat', 'hollis', { role: 'isle' }),
  agathe: c('Agathe Merrow', 'cormorant', 'agathe', { role: 'spire' }),
  teo: c('Teo Varga', 'raccoon', 'teo', { role: 'spire' }),
  dov: c('Dov Lattimer', 'kinkajou', 'dov', { role: 'isle' }),
  bastien: c('Bastien Kell', 'mink', 'bastien', { role: 'summit' }),
  cass: c('Cass Rune', 'lynx', 'cass', { role: 'summit' }),
  idris: c('Idris Fenwake', 'great northern diver', 'idris', { role: 'champion' }),

  'route-trainer': c('Route trainer', 'trainer', 'trainerVest', { role: 'trainer', palette: 'routeTrainer', portrait: null }),
};

for (const [id, ch] of Object.entries(RAW)) {
  if (!ch.palette) ch.palette = id;
  if (ch.portrait === undefined) ch.portrait = id;
}
export const CHARACTERS = RAW;
