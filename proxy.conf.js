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
 * Dev proxy for Helpline1097-UI-NEXT.
 *
 * In development the environment base URLs are origin-relative ('/'), so every API
 * call is same-origin (http://localhost:4200/...) and gets forwarded here to the
 * shared AMRIT dev backend. This avoids CORS during local development.
 *
 * NOTE: the `context` list below is the set of top-level API path segments observed
 * in the legacy Helpline1097-UI. Extend/correct it (and the matching base URLs in
 * src/environments/environment.development.ts) as real endpoints are wired in Phase 1/3,
 * once the backend's exact path layout is confirmed.
 */
const TARGET = 'https://amritwprdev.piramalswasthya.org';

module.exports = [
  {
    context: [
      '/cti',
      '/user',
      '/beneficiary',
      '/common',
      '/commonapi',
      '/1097',
      '/1097obj',
      '/admin',
      '/adminapi',
      '/apiman-gateway',
      '/notification',
      '/kmfilemanager',
      '/platform-feedback',
    ],
    target: TARGET,
    secure: true,
    changeOrigin: true,
    logLevel: 'debug',
  },
];
