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
 * Ensures every source file carries the AMRIT GPL-3.0 header (idempotent).
 * Usage: node scripts/add-license-headers.mjs        (apply)
 *        node scripts/add-license-headers.mjs --check (CI: fail if any file is missing it)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['src', 'scripts'];
const ROOT_FILES = ['proxy.conf.js'];
const EXTS = new Set(['.ts', '.html', '.css', '.scss', '.js', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', 'Common-UI', 'dist', '.angular', '.git', 'out-tsc']);
const MARKER = 'GNU General Public License';

const BODY = [
  'AMRIT – Accessible Medical Records via Integrated Technology',
  'Integrated EHR (Electronic Health Records) Solution',
  '',
  'Copyright (C) "Piramal Swasthya Management and Research Institute"',
  '',
  'This file is part of AMRIT.',
  '',
  'This program is free software: you can redistribute it and/or modify',
  'it under the terms of the GNU General Public License as published by',
  'the Free Software Foundation, either version 3 of the License, or',
  '(at your option) any later version.',
  '',
  'This program is distributed in the hope that it will be useful,',
  'but WITHOUT ANY WARRANTY; without even the implied warranty of',
  'MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the',
  'GNU General Public License for more details.',
  '',
  'You should have received a copy of the GNU General Public License',
  'along with this program.  If not, see https://www.gnu.org/licenses/.',
];

function header(ext) {
  if (ext === '.html') return `<!--\n${BODY.map((l) => `  ${l}`.trimEnd()).join('\n')}\n-->\n\n`;
  return `/*\n${BODY.map((l) => ` * ${l}`.trimEnd()).join('\n')}\n */\n\n`;
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (EXTS.has(extname(name))) acc.push(p);
  }
  return acc;
}

const check = process.argv.includes('--check');
const files = [...ROOTS.flatMap((r) => walk(r)), ...ROOT_FILES];
const missing = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (content.includes(MARKER)) continue;
  if (check) {
    missing.push(file);
    continue;
  }
  writeFileSync(file, header(extname(file)) + content);
  console.log(`+ header added: ${file}`);
}

if (check && missing.length) {
  console.error(`License header MISSING in ${missing.length} file(s):`);
  missing.forEach((f) => console.error(`  ${f}`));
  process.exit(1);
}
console.log(check ? 'license-check passed.' : 'done.');
