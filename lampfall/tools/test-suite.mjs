#!/usr/bin/env node
// Run each file in a fresh process with a portable timeout on macOS, Linux, and Windows.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const pattern = process.argv[2] ?? '';
// test/ plus every prototype's own test folder (proto/<name>/test), as the original find-based gate did.
const isTest = (f) => /\.test\.m?js$/.test(f);
const protoTests = existsSync('proto')
  ? readdirSync('proto', { recursive: true }).map(String).filter(f => isTest(f) && f.split(/[\\/]/).includes('test')).map(f => join('proto', f))
  : [];
const files = [...readdirSync('test').filter(isTest).map(f => join('test', f)), ...protoTests].filter(f => f.includes(pattern)).sort();
let pass = 0, fail = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { encoding: 'utf8', timeout: Number(process.env.TEST_TIMEOUT ?? 180) * 1000, maxBuffer: 16 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const p = Number(output.match(/^# pass (\d+)/m)?.[1] ?? 0);
  const f = Number(output.match(/^# fail (\d+)/m)?.[1] ?? 0) || (result.status !== 0 ? 1 : 0);
  pass += p; fail += f;
  console.log(`${file.padEnd(60)} pass ${String(p).padEnd(4)} fail ${f}`);
  if (f) console.log(output);
  if (result.error) console.error(result.error.message);
}
console.log(`TOTAL: pass ${pass} fail ${fail} (${files.length} files)`);
process.exit(fail || !files.length ? 1 : 0);
