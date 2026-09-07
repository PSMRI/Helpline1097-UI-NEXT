#!/usr/bin/env node

/*
 * AMRIT – Accessible Medical Records via Integrated Technologies
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

const fs = require('fs');
const path = require('path');

const ejs = require('ejs');

const environmentFilesDirectory = path.join(__dirname, '../src/environments');
const targetEnvironmentTemplateFileName = 'environment.ci.ts.template';
const targetEnvironmentFileName = 'environment.ci.ts';

// Load template file
const environmentTemplate = fs.readFileSync(
  path.join(environmentFilesDirectory, targetEnvironmentTemplateFileName),
  { encoding: 'utf-8' },
);

const defaultEnvValues = {
  SESSION_STORAGE_ENC_KEY: '',
  COMMON_API_BASE: '',
  ADMIN_API_BASE: '',
  API_1097_BASE: '',
  TELEPHONE_SERVER: '',
  SITE_KEY: '',
  CAPTCHA_CHALLENGE_URL: '',
  ENABLE_CAPTCHA: false,
};

// Let real process.env values (injected by the deploy pipeline per target
// environment) override the defaults above. process.env entries are always
// strings, so ENABLE_CAPTCHA is normalized to an actual boolean below rather
// than passed through as the string "true"/"false"/"".
const rawEnvValues = Object.assign({}, defaultEnvValues, process.env);

const stringEnvKeys = Object.keys(defaultEnvValues).filter((key) => key !== 'ENABLE_CAPTCHA');

// The template inserts these via EJS's raw `<%- %>` tag (not the escaping
// `<%= %>` tag), so pre-serialize here: JSON.stringify gives each string a
// valid, self-quoting TS string literal (preserving `&`/quotes in URLs
// untouched), and ENABLE_CAPTCHA becomes a bare `true`/`false` literal.
const templateValues = {};
for (const key of stringEnvKeys) {
  templateValues[key] = JSON.stringify(String(rawEnvValues[key]));
}
templateValues.ENABLE_CAPTCHA =
  rawEnvValues.ENABLE_CAPTCHA === true || rawEnvValues.ENABLE_CAPTCHA === 'true';

// Generate output data
const output = ejs.render(environmentTemplate, templateValues);
// Write environment file
fs.writeFileSync(path.join(environmentFilesDirectory, targetEnvironmentFileName), output);

// The `ci` build configuration's fileReplacements entry swaps
// environment.ts's content for environment.ci.ts's at bundle time, but
// TypeScript resolves the `@env/environment` path alias to environment.ts
// before that swap happens, so the file must exist on disk (its content is
// irrelevant — it's replaced before compilation reads it). It's git-ignored,
// so a fresh checkout otherwise has no such file at all.
const placeholderEnvironmentPath = path.join(environmentFilesDirectory, 'environment.ts');
if (!fs.existsSync(placeholderEnvironmentPath)) {
  fs.writeFileSync(placeholderEnvironmentPath, '');
}

process.exit(0);
