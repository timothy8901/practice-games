/** The complete story registry. The host merges NPC, thread and trainer scripts alongside it. */
import { deepFreeze } from '../ids.js';
import opening from './story-opening.js';
import isles from './story-isles.js';
import acts from './story-acts.js';
import ending from './story-ending.js';
export { READING_PHASES } from './story-ending.js';
export { STORY_TRIGGERS, EVENT_SCRIPTS, SCRIPT_HOOKS } from './triggers.js';
export const STORY_SCRIPTS = deepFreeze({ ...opening, ...isles, ...acts, ...ending,
  // dayFlow's established id, retained as an alias for save/bookmark compatibility.
  relighting: [{ op: 'call', script: 'the-relighting' }, { op: 'end' }],
});
export const SCRIPTS = STORY_SCRIPTS;
export default STORY_SCRIPTS;
