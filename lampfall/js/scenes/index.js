/**
 * Scene registry: name -> factory. Append-only, one line per scene, alphabetical. [shared touch point]
 * Scenes push by name through `G.push(name, params)`; nothing imports a scene module directly.
 * @module scenes/index
 */
import { createBagScene } from './bag.js';
import { createBattleScene } from './battle.js';
import { createBootScene } from './boot.js';
import { createBoxScene } from './box.js';
import { createCreditsScene } from './credits.js';
import { createCutsceneScene } from './cutscene.js';
import { createDayPageScene } from './dayPage.js';
import { createDebugOverlayScene } from './debugOverlay.js';
import { createDialogueScene } from './dialogue.js';
import { createEndingScene } from './ending.js';
import { createFieldLogScene } from './fieldLog.js';
import { createFishingScene } from './fishing.js';
import { createForecastScene } from './forecast.js';
import { createLeaseCardScene } from './leaseCard.js';
import { createLedgerScene } from './ledger.js';
import { createLetterScene } from './letter.js';
import { createMapScreenScene } from './mapScreen.js';
import { createMenuScene } from './menu.js';
import { createOverworldScene } from './overworld.js';
import { createPartyScene } from './party.js';
import { createSaveLoadScene } from './saveLoad.js';
import { createSeedCardScene } from './seedCard.js';
import { createSettingsScene } from './settings.js';
import { createShopScene } from './shop.js';
import { createTitleScene } from './title.js';

/** @type {Readonly<Record<string, (G: object) => import('../core/scene.js').Scene>>} */
export const sceneFactories = Object.freeze({
  bag: createBagScene,
  battle: createBattleScene,
  boot: createBootScene,
  box: createBoxScene,
  credits: createCreditsScene,
  cutscene: createCutsceneScene,
  dayPage: createDayPageScene,
  debugOverlay: createDebugOverlayScene,
  dialogue: createDialogueScene,
  ending: createEndingScene,
  fieldLog: createFieldLogScene,
  fishing: createFishingScene,
  forecast: createForecastScene,
  leaseCard: createLeaseCardScene,
  ledger: createLedgerScene,
  letter: createLetterScene,
  mapScreen: createMapScreenScene,
  menu: createMenuScene,
  overworld: createOverworldScene,
  party: createPartyScene,
  saveLoad: createSaveLoadScene,
  seedCard: createSeedCardScene,
  settings: createSettingsScene,
  shop: createShopScene,
  title: createTitleScene,
});

/** Scene names in registry order. */
export const SCENE_NAMES = Object.freeze(Object.keys(sceneFactories));
