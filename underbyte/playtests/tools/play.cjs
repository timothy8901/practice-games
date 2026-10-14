'use strict';
// Client for playserver.cjs. One command per call, so an agent can play from a shell:
//
//   node play.cjs start <session-dir> [--save <save.json>] [--pad] [--size 960x540]
//   node play.cjs <session-dir> '{"act":[{"down":"right"},{"wait":600},{"tap":"jump"}]}'
//   node play.cjs <session-dir> '{"debug":"UB.debug.warp(\"dc_cross\",\"L\")"}'
//   node play.cjs <session-dir> '{"mark":"BUG: fell through the floor here"}'
//   node play.cjs <session-dir> '{"shot":true}'
//   node play.cjs <session-dir> '{"quit":true,"out":"newcomer-01-first-steps.mp4"}'
//
// Every turn prints JSON: the game state, events since the last turn (damage, deaths, room
// changes...), any console errors, the screenshot path to look at, and "video" = the timestamp
// (seconds) this moment will have in the final recording. See playtests/README.md.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const args = process.argv.slice(2);

function post(port, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/cmd', headers: { 'content-type': 'application/json' } }, (res) => {
      let data = ''; res.on('data', (c) => { data += c; }); res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10 * 60 * 1000, () => req.destroy(new Error('timeout')));
    req.end(body);
  });
}

(async () => {
  if (args[0] === 'start') {
    const dir = path.resolve(args[1]);
    fs.mkdirSync(dir, { recursive: true });
    const sj = path.join(dir, 'server.json');
    if (fs.existsSync(sj)) { console.log(JSON.stringify({ ok: true, already: true, session: dir })); return; }
    fs.rmSync(path.join(dir, 'server-error.txt'), { force: true });
    const out = fs.openSync(path.join(dir, 'server.log'), 'a');
    const child = spawn(process.execPath, [path.join(__dirname, 'playserver.cjs'), '--session', dir, ...args.slice(2)], { detached: true, stdio: ['ignore', out, out], env: process.env });
    child.unref();
    for (let i = 0; i < 300; i++) {
      if (fs.existsSync(sj)) { console.log(JSON.stringify({ ok: true, session: dir, server: JSON.parse(fs.readFileSync(sj, 'utf8')) })); return; }
      const err = path.join(dir, 'server-error.txt');
      if (fs.existsSync(err)) { console.log(JSON.stringify({ ok: false, error: fs.readFileSync(err, 'utf8') })); process.exit(1); }
      await new Promise((r) => setTimeout(r, 100));
    }
    console.log(JSON.stringify({ ok: false, error: 'server did not start in 30 s; see ' + path.join(dir, 'server.log') }));
    process.exit(1);
  }
  const dir = path.resolve(args[0] || '');
  const sj = path.join(dir, 'server.json');
  if (!fs.existsSync(sj)) { console.log(JSON.stringify({ ok: false, error: 'no running session in ' + dir + ' (run: node play.cjs start ' + dir + ')' })); process.exit(1); }
  const { port } = JSON.parse(fs.readFileSync(sj, 'utf8'));
  let body = args[1] || '{"shot":true}';
  if (body === 'quit') body = '{"quit":true}';
  JSON.parse(body); // validate before sending
  console.log(await post(port, body));
})().catch((e) => { console.log(JSON.stringify({ ok: false, error: String(e && e.message || e) })); process.exit(1); });
