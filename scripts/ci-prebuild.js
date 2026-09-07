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

const rawEnvValues = Object.assign({}, defaultEnvValues, process.env);

// Old-1097 pipeline env names accepted alongside the 104-NEXT ones.
if (!rawEnvValues.API_1097_BASE && process.env.HELPLINE1097_API_BASE) {
  rawEnvValues.API_1097_BASE = process.env.HELPLINE1097_API_BASE;
}
if (!rawEnvValues.TELEPHONE_SERVER && process.env.TELEPHONY_SERVER) {
  rawEnvValues.TELEPHONE_SERVER = process.env.TELEPHONY_SERVER;
}

const output = ejs.render(environmentTemplate, rawEnvValues);
fs.writeFileSync(path.join(environmentFilesDirectory, targetEnvironmentFileName), output);

// environment.ts is git-ignored but must exist for the `@env/environment` alias
// to resolve; the ci fileReplacement swaps its content before compilation.
const placeholderEnvironmentPath = path.join(environmentFilesDirectory, 'environment.ts');
if (!fs.existsSync(placeholderEnvironmentPath)) {
  fs.writeFileSync(placeholderEnvironmentPath, '');
}

process.exit(0);
