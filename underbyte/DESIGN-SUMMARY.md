# UNDERBYTE — Design Summary (1-page digest of `DESIGN.md`)

`DESIGN.md` is canonical; this page is for quick reference only. Section numbers refer to it.

## Names

* **Fighters (5):** Tessik (The Courier Lantern, Signal, balanced) · Brackmaw (The Walking Vault, Ore, heavy) · Vellix (The Prefetch Streak, Flux, fast-fragile) · Orrubel (The Ring Warden, Cipher, zoner) · Korvask (The Clamp Balancer, Pressure, bruiser). Ids: `tessik brackmaw vellix orrubel korvask`.
* **Zones (5, in order):** Driftcache (`driftcache`, 1) → Loomworks (`loomworks`, 2) → Brinevault (`brinevault`, 3) → Nullspire (`nullspire`, 4) → Rootwell (`rootwell`, 5).
* **Bosses (4):** Tallock, Warden of the Stack (`dc_sentinel`, HP 120) → Weftyr, The Shuttle That Would Not Stop (`lw_weftyr`, HP 180) → Corrosant, Keeper of the Brine (`bv_corrosant`, HP 240) → Kernauth, The Root Process (`rw_throne`, phase 1 HP 200 seated, phase 2 HP 240 Unbound).
* **Abilities (fixed order):** Echo Jump `echoJump` (boss 1) → Burst Line `burstLine` (boss 2) → Grip Protocol `gripProtocol` (boss 3).
* **Vendor:** Scrivvet (`dc_shrine` and `rw_rest`): Spare Cell 90 (max energy 125) · Hot Clock 160 (meter gain ×1.5) · Deep Ping 120 (map reveal).
* **Enemies (10 + 11 variants):** scuttlebit, hopnode, driftmoth (brinejelly), glarewisp (rootwisp), spitvalve (acid valve, twin valve), rambyte (rootram), platewalker (rootplate), broodcell (+motes), droplatch, voltwheel; scuttlebit variants brinecrab/static-shot/rootbound, hopnode dripnode/nullnode.

## Rooms (23) — critical-path order

`dc_wake` (start, node) · `dc_fall` (core 3) · `dc_cross` · `dc_loft` (core 1) · `dc_shrine` (node, vendor) · `dc_sentinel` (boss 1) · `lw_hoist` · `lw_belts` (core 2) · `lw_shaft` · `lw_rest` (node) · `lw_weftyr` (boss 2) · `bv_sluice` · `bv_cistern` · `bv_catwalk` · `bv_rest` (node) · `bv_corrosant` (boss 3) · `ns_base` · `ns_climb` · `ns_rest` (node) · `ns_plunge` · `rw_gate` · `rw_rest` (node, vendor) · `rw_throne` (final).

Gates: `dc_sentinel.R2` 5-tile block (Echo Jump) · `bv_sluice` / `bv_catwalk` 6-tile gap in a 2-tall crawlspace (Burst Line) · `ns_base` 10-tile shaft (Grip Protocol). Cores: 1 `dc_loft` (27,12) EJ · 2 `lw_belts` (93,6) BL · 3 `dc_fall` (24,4) GP. Nodes: dc_wake (5,12) · dc_shrine (9,14) · lw_rest (15,14) · bv_rest (15,13) · ns_rest (15,14) · rw_rest (9,14). 25 reciprocal exit pairs; loops A (zones 1–2 via `lw_shaft`), B (2–3 via `bv_catwalk`), C (zone 4 via `ns_plunge.L2`).

## Key numbers

* 60 Hz fixed logic; canvas 960×540; tile 30 px. Fighters in px/s, enemies/bosses/movers in px/frame.
* Fighter stats (HP · run · jump · gravity · 2nd jump · dash · body): Tessik 5·235·640·1800·0.85·180/12f·22×48 — Brackmaw 6·180·620·2000·**1.00**·180/15f·34×54 — Vellix 4·300·**615**·1750·0.90·**210**/10f·18×40 — Orrubel 5·215·630·1800·0.85·180/12f·24×44 — Korvask 6·200·610·1900·**1.00**·180/14f·30×56.
* Jump apex 96–114 px (clears 3 tiles, fails 4); Echo-Jump apex 190–196 (clears 6, fails 7); dash 180 (Vellix 210), `vy=0`, 18 f cooldown, no i-frames; wall jump `vx=(run+40) away, vy=−0.95·jump`; chute launch 1.2·jump; 6 px ledge step-up; coyote 6 f; buffer 6 f; jump cut ×0.45.
* Hurt: 1 heart (boss attacks 1–2), 16 f hurt, 60 i-frames, knockback (240 away, −300)·weight, 6 f hitstop. Hazards: 1 heart ignoring i-frames, 30 f freeze, respawn at the last entry spawn with 45 i-frames. Pogo `vy=−580`.
* Energy max 100 (125), start 50, regen 3/s (6 in Overclock); special costs 30/40/25/35/20; ultimate 40. Meter 100: hits +2/+4/+6/+5/+2/+3, bit +1, spark +10, shard +15, core +25; Overclock 720 f, dmg ×1.5, run ×1.15, dash ×1.15, reach ×1.2, kb taken ×0.5.
* Pickups: bits small 1 / medium 5 / large 20; heart +1 HP; spark +25 energy +10 meter; shard +15 meter. Drops: heart 12 % + 8 %/missing (cap 40), spark 25 % below half energy else 5 %, shard 8 % (guaranteed from rambyte/platewalker/broodcell/voltwheel). Bosses: 60/100/140 bits (large coins) + 3 sparks. Placed bits total 331; enemies 239 per full clear.
* Enemy HP: scuttlebit 6 (9/9/12) · hopnode 9 (12) · driftmoth 6 / brinejelly 9 · glarewisp 9 (12) · spitvalve 12 · rambyte 18 (24) · platewalker 15 (21) · broodcell 21 (27), motes 3 · droplatch 9 · voltwheel 12. `kbResist`: 0 for spitvalve, broodcell, voltwheel, charging rambyte, guarding platewalker; 0.5 rambyte/platewalker otherwise; 1.0 the rest; bosses 0.
* Boss intro card 150 f; seals drop 12 f; enrage at Tallock ≤36 / Weftyr ≤54 / Corrosant ≤72 (Flood) / Kernauth-2 ≤60 (Panic Loop); ability pickup sequence 120 f; boss death shake 12/40.
* Room transition: freeze 6 + slide 18 + settle 4 = 28 f. Zone toast 150 f; lore card ≤240 f once per zone. Map 40 px per screen (grid in §6).
* Music: Title "Boot Sequence" 80 BPM · Driftcache "Idle Loop" 72 · Loomworks "Pressure Line" 104 · Brinevault "Facets" 96 · Nullspire "Unanswered" 84 · Rootwell "Null Pointer" 60 · Boss "Fault Handler" 150 (phase 2: 158). Ambient SFX layer per zone (§13.10). Audio context only after the first gesture; 24-voice cap.
* Save (`underbyte.save`, one slot, §14): fighter, roomId, spawn.nodeId, hearts/max/base, cores, abilities, bits, bitsLifetime, discovered, visited, bossesDefeated, bitsCollected, vendor, nodesUsed, loreSeen, hints, enemiesPurged, playTimeFrames, deaths, victory. Written at nodes, boss pickups, vendor purchases, victory. Settings in `underbyte.settings`.
* HUD: hearts (24,22) pitch 32 (max 9 cells; core hearts are diamonds); energy bar (24,56) 180×12; meter (24,88) 180×8; bits top-right at (896,32); boss bar (180,486) 600×30; banner panel (240,200) 480×120; map panel (20,20) 920×500.
* Controls: arrows/WASD move, Space/W/Up jump, Z/J light, X/K heavy, C/L special, Shift/; dash, V/I overclock, Enter confirm, Esc/P pause, M/Tab map, Up interact, Down+Jump drop through. Gamepad: A jump, X light, Y heavy, B special, RB/LB dash, LT/RT overclock, Start pause, Back map.
* Debug API `window.UB.debug` (§16.9): state, warp, teleport, grant, setHp/setMaxHp/setEnergy/setMeter/addBits, defeatBoss, killEnemies, god, step, pressed, newGame/continueGame/toTitle, save/load/reset, audio/mute, rooms, enemies, boss, showHitboxes.

## Rulings to remember (§16)

Dash 180 for all (Vellix 210) · Vellix jump 615 · heavies' second jump 1.00, Vellix 0.90 · Blink Strike floor-bound · all pools respawn · enemy hit reaction = combat system with per-type `kbResist` · world names win over presentation's provisional ones · 7 world-data fixes (dc_fall core-3 access, ns_base well hole, bv_catwalk antechamber, bv_sluice gate hardening, three placement moves).
