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

/*
 * Dev proxy for the default `development` / `dev` serve configurations.
 *
 * The dev backend (amritwprdev) sends no CORS headers for http://localhost:4200, so the
 * browser cannot call it directly. The dev environment uses origin-relative versioned
 * base paths (see environment.dev.ts), and this proxy forwards them server-side to the
 * backend, bypassing CORS. Keep these contexts in sync with the env base URLs.
 */
const TARGET = 'https://uatamrit.piramalswasthya.org';

module.exports = [
  {
    context: ['/common-api', '/1097-api', '/admin-api'],
    target: TARGET,
    secure: true,
    changeOrigin: true,
    logLevel: 'debug',
    // The UAT backend enforces CORS and rejects the browser's `Origin: http://localhost:4200`
    // with 403 "Invalid CORS request". Since the proxy forwards the call server-side, strip
    // the Origin/Referer so the backend treats it as a non-CORS request (dev-only).
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin');
        proxyReq.removeHeader('referer');
      });
    },
  },
];
