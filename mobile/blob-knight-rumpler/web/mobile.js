/* Blob Knight Rumpler - mobile layer. build.py injects this after the game's own script.
 *
 * It adds on-screen touch controls that write straight into game.input, pauses
 * the fight whenever the app or tab goes to the background, swaps the keyboard
 * hints for touch ones, and gives the Android wrapper two hooks:
 *   BKR.back()     -> true if the game used the Back press (pause, resume, menus)
 *   BKR.appPause() -> the app is about to leave the screen
 *
 * URL switches: ?app=android (set by the app), ?touch=1 / ?touch=0 to force the
 * touch controls on or off (they default to on for touchscreen phones/tablets).
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search);
  const IN_APP = q.get('app') === 'android';
  const TOUCH = q.get('touch') === '1' ||
    (q.get('touch') !== '0' && (IN_APP || (window.matchMedia && matchMedia('(pointer: coarse)').matches)));
  const root = document.documentElement;
  if (TOUCH) root.classList.add('bkr-touch');
  if (IN_APP) root.classList.add('bkr-app');

  const wrap = document.getElementById('game-wrap');
  const input = game.input;
  input.ax = 0; input.az = 0;   // analog stick direction, read by the patched game loop

  // Material Design icon paths (Apache 2.0).
  const ICON = {
    a1: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>',
    a2: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>',
    jump: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 17.59L7.41 19 12 14.42 16.59 19 18 17.59l-6-6z"/><path fill="currentColor" d="M6 11l1.41 1.41L12 7.83l4.59 4.58L18 11l-6-6z"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3z"/>' +
      '<path class="on" fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>' +
      '<path class="off" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M15.5 9l5.5 6m0-6l-5.5 6"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg>',
  };
  const PILL = (label, color) => `<span class="bkr-pill" style="--c:${color}">${label}</span>`;
  const COLORS = { a1: '#ff5a7a', a2: '#9b6bff', shield: '#3f9be8', jump: '#43b864' };

  // ------------------------------------------------------------ controls DOM
  const layer = document.createElement('div');
  layer.id = 'bkr-touch';
  const stickEl = document.createElement('div');
  stickEl.className = 'bkr-stick';
  const knob = document.createElement('div');
  knob.className = 'bkr-knob';
  stickEl.append(knob);
  layer.append(stickEl);

  // Radii are at scale 1; layout() scales them to the screen.
  const btns = {};
  for (const [act, r, label, ring] of [['a1', 42, 'Attack', true], ['a2', 35, 'Special', true],
                                       ['shield', 32, 'Shield', true], ['jump', 32, 'Jump', false]]) {
    const el = document.createElement('div');
    el.className = 'bkr-btn bkr-' + act;
    el.style.setProperty('--c', COLORS[act]);
    el.innerHTML = (ring ? '<i class="ring"></i>' : '') + ICON[act] + '<b></b>';
    el.querySelector('b').textContent = label;
    layer.append(el);
    btns[act] = { act, el, r0: r, x: 0, y: 0, r: 0, p: -1, label: el.querySelector('b') };
  }
  wrap.append(layer);

  const topBar = document.createElement('div');
  topBar.id = 'bkr-top';
  const mkTop = (id, icon, label) => {
    const b = document.createElement('button');
    b.id = id; b.type = 'button'; b.innerHTML = icon; b.setAttribute('aria-label', label);
    topBar.append(b);
    return b;
  };
  const pauseBtn = mkTop('bkr-pause', ICON.pause, 'Pause');
  const soundBtn = mkTop('bkr-sound', ICON.sound, 'Sound on/off');
  wrap.append(topBar);

  const rotate = document.createElement('div');
  rotate.id = 'bkr-rotate';
  rotate.innerHTML = ICON.phone + '<div>Turn your phone sideways to play</div>';
  document.body.append(rotate);

  // env(safe-area-inset-*) as numbers, for placing controls clear of notches.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(probe);

  // ------------------------------------------------------------------ layout
  let W = 1, H = 1, S = 1;
  const safe = { t: 0, r: 0, b: 0, l: 0 };
  const stick = { id: null, cx: 0, cy: 0, hx: 0, hy: 0 };

  function layout() {
    const rect = wrap.getBoundingClientRect();
    W = rect.width || innerWidth; H = rect.height || innerHeight;
    const cs = getComputedStyle(probe);
    safe.t = parseFloat(cs.paddingTop) || 0; safe.r = parseFloat(cs.paddingRight) || 0;
    safe.b = parseFloat(cs.paddingBottom) || 0; safe.l = parseFloat(cs.paddingLeft) || 0;
    // 1.0 on a typical 900x410 landscape phone; bigger on tablets, smaller on small phones.
    S = Math.max(0.72, Math.min(1.3, Math.min(W, H * 1.9) / 800));
    root.style.setProperty('--s', S.toFixed(3));

    // Attack sits in the thumb's resting spot; the others fan out on an arc around it.
    const ax = W - safe.r - 86 * S, ay = H - safe.b - 82 * S, arc = 102 * S;
    const put = (b, x, y) => {
      b.x = x; b.y = y; b.r = b.r0 * S;
      const st = b.el.style;
      st.width = st.height = (2 * b.r) + 'px';
      st.left = (x - b.r) + 'px'; st.top = (y - b.r) + 'px';
    };
    const onArc = (deg) => [ax + arc * Math.cos(deg * Math.PI / 180), ay + arc * Math.sin(deg * Math.PI / 180)];
    put(btns.a1, ax, ay);
    put(btns.a2, ...onArc(190));
    put(btns.shield, ...onArc(232));
    put(btns.jump, ...onArc(274));

    stick.hx = safe.l + 112 * S; stick.hy = H - safe.b - 104 * S;
    if (stick.id === null) placeStick(stick.hx, stick.hy);
  }

  // ------------------------------------------------------------------- stick
  function placeStick(x, y) {
    stick.cx = x; stick.cy = y;
    const r = 62 * S;
    stickEl.style.transform = `translate(${x - r}px, ${y - r}px)`;
  }
  function stickStart(id, x, y) {
    stick.id = id;
    const r = 62 * S;
    // The stick appears under the thumb, nudged in so its ring stays on screen.
    placeStick(Math.max(safe.l + r + 4, Math.min(x, W - r - 4)), Math.max(safe.t + r + 4, Math.min(y, H - safe.b - r - 4)));
    stickEl.classList.add('active');
    stickMove(x, y);
  }
  function stickMove(x, y) {
    const travel = 48 * S;
    let dx = x - stick.cx, dy = y - stick.cy, d = Math.hypot(dx, dy);
    if (d > travel * 1.5) {
      // The thumb ran past the rim: drag the base along, so reversing is instant.
      const k = (d - travel * 1.5) / d;
      placeStick(stick.cx + dx * k, stick.cy + dy * k);
      dx = x - stick.cx; dy = y - stick.cy; d = Math.hypot(dx, dy);
    }
    const m = Math.min(d, travel), ux = d ? dx / d : 0, uy = d ? dy / d : 0;
    knob.style.transform = `translate(${ux * m}px, ${uy * m}px)`;
    // Full-speed movement in any direction past a small dead zone (the game
    // normalizes the vector). Screen right = +x, screen down = +z (toward the camera).
    if (d < travel * 0.24) { input.ax = 0; input.az = 0; } else { input.ax = ux; input.az = uy; }
  }
  function stickEnd() {
    stick.id = null;
    input.ax = 0; input.az = 0;
    knob.style.transform = '';
    stickEl.classList.remove('active');
    placeStick(stick.hx, stick.hy);
  }

  // ----------------------------------------------------------------- buttons
  const held = { a1: 0, a2: 0, jump: 0, shield: 0 };
  const pressedOn = { a1: -1, a2: -1, jump: -1, shield: -1 };   // frame number of the press
  const releaseNextFrame = new Set();
  let frameNo = 0;

  function press(act) {
    if (held[act]++ > 0) return;
    releaseNextFrame.delete(act);
    input[act] = true;
    pressedOn[act] = frameNo;
    btns[act].el.classList.add('down');
  }
  function release(act) {
    if (held[act] === 0 || --held[act] > 0) return;
    btns[act].el.classList.remove('down');
    // The game samples buttons once per frame. If no frame has run since the press,
    // keep it down until the next one, so even a quick tap on a slow phone lands.
    if (frameNo > pressedOn[act]) input[act] = false; else releaseNextFrame.add(act);
  }
  function hitButton(x, y, slack) {
    let best = null, bestD = Infinity;
    for (const k in btns) {
      const b = btns[k], d = Math.hypot(x - b.x, y - b.y);
      if (d < b.r * slack && d < bestD) { best = b; bestD = d; }
    }
    return best;
  }

  // ------------------------------------------------------------ touch input
  const owners = new Map();   // pointerId -> 'stick' | action held by that finger
  const local = (e) => {
    const r = wrap.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  layer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const [x, y] = local(e);
    const b = hitButton(x, y, 1.2);
    if (b) {
      owners.set(e.pointerId, b.act);
      press(b.act);
    } else if (x < W * 0.5 && stick.id === null) {
      owners.set(e.pointerId, 'stick');
      stickStart(e.pointerId, x, y);
    } else {
      return;
    }
    try { layer.setPointerCapture(e.pointerId); } catch (_) { /* already captured */ }
  });
  layer.addEventListener('pointermove', (e) => {
    const who = owners.get(e.pointerId);
    if (!who) return;
    const [x, y] = local(e);
    if (who === 'stick') { stickMove(x, y); return; }
    // Slide from one button onto another without lifting (attack -> special, etc.).
    const b = hitButton(x, y, 1.0);
    if (b && b.act !== who) { release(who); owners.set(e.pointerId, b.act); press(b.act); }
  });
  const lift = (e) => {
    const who = owners.get(e.pointerId);
    if (!who) return;
    owners.delete(e.pointerId);
    if (who === 'stick') stickEnd(); else release(who);
  };
  layer.addEventListener('pointerup', lift);
  layer.addEventListener('pointercancel', lift);
  layer.addEventListener('lostpointercapture', lift);

  function releaseAll() {
    owners.clear();
    releaseNextFrame.clear();
    for (const k in held) { held[k] = 0; input[k] = false; btns[k].el.classList.remove('down'); }
    if (stick.id !== null) stickEnd(); else { input.ax = 0; input.az = 0; }
  }

  // ------------------------------------------------------- pause and sound
  function pauseFight() {
    releaseAll();
    if (game.phase !== 'fight') return false;
    game.phase = 'paused';
    renderOverlay();
    return true;
  }
  function syncSound() {
    const on = sfx.isEnabled();
    soundBtn.classList.toggle('off', !on);
    document.querySelectorAll('[data-kb="sound"]').forEach((b) => { b.textContent = 'Sound: ' + (on ? 'On' : 'Off'); });
  }
  function toggleSound() { sfx.toggle(); syncSound(); sfx.select(); }
  pauseBtn.addEventListener('click', () => { if (pauseFight()) sfx.select(); });
  soundBtn.addEventListener('click', toggleSound);

  // ----------------------------------------------------------------- menus
  // Keep the game's renderOverlay, then touch up its cards for this edition.
  const baseRenderOverlay = window.renderOverlay;
  window.renderOverlay = function () {
    baseRenderOverlay.apply(this, arguments);
    const card = overlayEl.querySelector('.overlay-card');
    if (!card) return;
    if (game.phase === 'menu') {
      card.insertAdjacentHTML('afterbegin', '<div class="bkr-brand">Blob Knight Rumpler</div>');
      const subs = [card.querySelector('#menu-controls'), card.querySelector('#menu-hint')];
      if (TOUCH && subs[0]) {
        subs[0].innerHTML = 'One circular arena, one CPU knight.<br>' +
          `Drag the left side of the screen to move. Every core has two attacks, ${PILL('Attack', COLORS.a1)} ` +
          `and ${PILL('Special', COLORS.a2)}, and a ${PILL('Shield', COLORS.shield)} you hold.<br>` +
          `${PILL('Jump', COLORS.jump)} hops over swings and projectiles.`;
      }
      if (TOUCH && subs[1]) {
        subs[1].innerHTML = 'Pause with the button at the top of the screen' + (IN_APP ? ' or your phone\'s Back button.' : '.');
      }
    }
    if (game.phase === 'menu' || game.phase === 'paused') {
      const row = card.querySelector('.overlay-buttons');
      if (row) row.insertAdjacentHTML('beforeend', '<button class="overlay-btn ghost" data-kb="sound"></button>');
      syncSound();
    }
  };
  overlayEl.addEventListener('click', (e) => { if (e.target.closest('[data-kb="sound"]')) toggleSound(); });

  if (TOUCH) {
    // "Special (J / Z)" -> "Special" in the HUD.
    const lab = document.getElementById('hud-p-special-bar').previousElementSibling;
    if (lab && lab.firstChild && lab.firstChild.nodeType === Node.TEXT_NODE) lab.firstChild.textContent = 'Special ';
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  if (TOUCH && !IN_APP) {
    // In a phone browser, go full screen and landscape on the first menu tap.
    overlayEl.addEventListener('click', () => {
      const d = document.documentElement;
      if (document.fullscreenElement || !d.requestFullscreen) return;
      d.requestFullscreen({ navigationUI: 'hide' }).then(() => {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      }).catch(() => {});
    }, true);
  }

  // ------------------------------------------------------- per-frame sync
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* not allowed yet */ } }
  // Move names run from "Bloom" to "Thunderstrike". Two-word names wrap; a long
  // single word is shrunk until it fits, measured rather than guessed.
  function setLabel(button, text) {
    const label = button.label;
    label.textContent = text;
    let size = 8.5;
    label.style.fontSize = 'calc(var(--s) * ' + size + 'px)';
    if (!label.clientWidth) { button.remeasure = true; return; }   // controls still hidden
    button.remeasure = false;
    while (size > 6 && label.scrollWidth > label.clientWidth) {
      size -= 0.4;
      label.style.fontSize = 'calc(var(--s) * ' + size + 'px)';
    }
  }
  function ring(b, v) {
    v = Math.round(Math.max(0, Math.min(1, v)) * 50) / 50;
    if (v !== b.p) { b.p = v; b.el.style.setProperty('--p', v); }
  }
  // Dynamic resolution: phones that can't hold 45 fps in a fight step the render
  // resolution down (2x -> 1x, a quarter at a time), then shadow detail. Never back
  // up, so it can't flicker between settings.
  // Phones start at 1.5x rather than 2x: the art is detailed enough that the extra
  // pixels cost more than they show, and a weak phone starts in a playable place.
  const perf = { cap: Math.min(TOUCH ? 1.5 : 2, window.devicePixelRatio || 1),
                 frames: 0, since: 0, last: 0, shadowsCut: false };
  function adaptResolution(t) {
    if (document.hidden) { perf.last = 0; perf.frames = 0; return; }
    if (!perf.last) { perf.last = t; perf.since = t + 1000; perf.frames = 0; return; }   // skip the first second
    perf.last = t;
    if (t < perf.since) return;
    perf.frames++;
    if (perf.frames < 2 || t - perf.since < 2000) return;
    const fps = (perf.frames - 1) * 1000 / (t - perf.since);
    perf.frames = 0; perf.since = t;
    if (fps >= (fighting ? 45 : 30)) return;   // menus render the same scene, just idle
    if (perf.cap > 1) {
      perf.cap = Math.max(1, perf.cap - 0.25);
      window.BKR_MAX_DPR = perf.cap;
      resize();
      console.log('[BKR] ' + fps.toFixed(0) + ' fps: render scale down to ' + perf.cap + 'x');
    } else if (!perf.shadowsCut && typeof sun !== 'undefined' && sun.shadow) {
      perf.shadowsCut = true;
      sun.shadow.mapSize.set(1024, 1024);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      console.log('[BKR] ' + fps.toFixed(0) + ' fps: shadow map down to 1024');
    }
  }

  function relabel() {
    const p = game.player;
    if (!p) return;
    setLabel(btns.a1, ABIL[p.ability].a1.label);
    setLabel(btns.a2, ABIL[p.ability].a2.label);
  }

  let fighting = null, lastAbility = null;
  const lastHp = { p: null, c: null };
  function tick(t) {
    requestAnimationFrame(tick);
    adaptResolution(t);
    // The game's loop registered its frame callback before this one, so by now it
    // has read this frame's input: taps held over from last frame can go.
    frameNo++;
    for (const act of releaseNextFrame) if (!held[act]) input[act] = false;
    releaseNextFrame.clear();
    const now = game.phase === 'fight';
    if (now !== fighting) {
      fighting = now;
      document.body.classList.toggle('bkr-fighting', now);
      if (now) { layout(); relabel(); } else releaseAll();
    }
    const p = game.player, c = game.cpu;
    if (!p) return;
    const A = ABIL[p.ability];
    if (p.ability !== lastAbility || btns.a1.remeasure || btns.a2.remeasure) {
      lastAbility = p.ability;
      relabel();
    }
    ring(btns.a1, 1 - p.cd.a1 / A.a1.cd);
    const sp = 1 - p.cd.a2 / A.a2.cd;
    ring(btns.a2, sp);
    btns.a2.el.classList.toggle('ready', sp >= 0.999);
    ring(btns.shield, p.shield.stamina);
    btns.shield.el.classList.toggle('low', p.shield.stamina < 0.3 || p.shield.broken > 0);
    // A short rumble when you get hit, a lighter tick when you land one.
    if (lastHp.p !== null && p.hp < lastHp.p) buzz(45);
    if (c && lastHp.c !== null && c.hp < lastHp.c) buzz(15);
    lastHp.p = p.hp; lastHp.c = c ? c.hp : null;
  }

  // --------------------------------------------------- background + Android
  function appPause() { pauseFight(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) appPause(); });
  window.addEventListener('blur', releaseAll);
  window.BKR = {
    back() {
      releaseAll();
      switch (game.phase) {
        case 'fight': game.phase = 'paused'; break;
        case 'paused': game.phase = 'fight'; break;
        case 'pick': game.phase = 'menu'; break;
        case 'foe': game.phase = 'pick'; break;
        case 'rules': game.phase = game.mode === 'survival' ? 'pick' : 'foe'; break;
        // a run abandoned from these screens still counts what it cleared
        case 'result': case 'roundover': quitToMenu(); sfx.select(); return true;
        default: return false;   // title menu: let Android close the app
      }
      sfx.select();
      renderOverlay();
      return true;
    },
    appPause,
  };

  if (TOUCH) {
    // Phone screens are small and the thumbs cover the corners: sit a little closer.
    // (Checked against the arena's far edge, which stays in frame.)
    camBasePos.set(0, 13.2, 11.2);
  }

  if (perf.cap < (window.devicePixelRatio || 1)) { window.BKR_MAX_DPR = perf.cap; resize(); }

  window.addEventListener('resize', layout);
  layout();
  renderOverlay();   // redraw the title card with this layer's touches
  requestAnimationFrame(tick);
  console.log('[BKR] mobile layer ready ' + JSON.stringify({
    touch: TOUCH, app: IN_APP, w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
    webgl2: !!(renderer.capabilities && renderer.capabilities.isWebGL2),
  }));
})();
