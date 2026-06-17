/*
 * AMRIT – Accessible Medical Records via Integrated Technology
 * Integrated EHR (Electronic Health Records) Solution
 *
 * Copyright (C) "Piramal Swasthya Management and Research Institute"
 *
 * This file is part of AMRIT.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

/*
 * verify:nostub — the anti-stub gate.
 *
 * Fails the build if AI-generated stub / placeholder markers appear in CHANGED
 * source files. Scans files changed vs origin/main (plus working-tree + untracked
 * changes); falls back to all tracked source files if no base ref is available.
 *
 * Tune BANNED / SRC below as the project grows.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

// Only scan app source; never scan this script (it literally contains the markers).
const SRC = /^src\/.*\.(ts|html|css|scss)$/;
const SKIP = /\.spec\.ts$/;

const BANNED = [
  { re: /\bTODO\b/, msg: 'TODO marker' },
  { re: /\bFIXME\b/, msg: 'FIXME marker' },
  { re: /\bXXX\b/, msg: 'XXX marker' },
  { re: /\bHACK\b/, msg: 'HACK marker' },
  { re: /@ts-ignore/, msg: '@ts-ignore' },
  { re: /@ts-nocheck/, msg: '@ts-nocheck' },
  { re: /not implemented/i, msg: '"not implemented"' },
  { re: /\bdebugger\b/, msg: 'debugger statement' },
  { re: /console\.(log|debug)\s*\(/, msg: 'leftover console.log/debug' },
  { re: /lorem ipsum/i, msg: 'lorem ipsum placeholder text' },
];

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
}

function changedFiles() {
  for (const base of ['origin/main', 'main']) {
    try {
      sh(`git rev-parse --verify ${base}`);
      const mergeBase = sh(`git merge-base ${base} HEAD`).trim();
      const committed = sh(`git diff --name-only ${mergeBase} HEAD`);
      const working = sh('git diff --name-only HEAD');
      const untracked = sh('git ls-files --others --exclude-standard');
      return [...new Set([committed, working, untracked].join('\n').split('\n'))].filter(Boolean);
    } catch {
      /* try next base */
    }
  }
  return sh('git ls-files').split('\n').filter(Boolean); // fallback: scan everything
}

const files = changedFiles().filter((f) => SRC.test(f) && !SKIP.test(f) && existsSync(f));
let violations = 0;

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const { re, msg } of BANNED) {
      if (re.test(line)) {
        console.error(`✗ ${file}:${i + 1}  ${msg}`);
        console.error(`    ${line.trim()}`);
        violations++;
      }
    }
  });
}

if (violations > 0) {
  console.error(`\nverify:nostub FAILED — ${violations} stub/placeholder marker(s) in changed files.`);
  process.exit(1);
}
console.log(`verify:nostub passed — scanned ${files.length} changed source file(s), no stubs found.`);
