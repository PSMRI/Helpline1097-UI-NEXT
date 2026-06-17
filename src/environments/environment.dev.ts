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

// Shared AMRIT dev backend, reached through the Angular dev PROXY (proxy.conf.js).
// Base URLs are origin-relative versioned paths so the browser stays same-origin
// (localhost:4200) and the dev server forwards them to
// https://amritwprdev.piramalswasthya.org. The backend sends no CORS headers for
// localhost, so direct (absolute-URL) calls from a browser are blocked — hence the proxy.
const sessionStorageEncKey = '';
const commonAPI = '/commonapi-v1.0/';
const adminAPI = '/adminapi-v1.0/';
const API1097 = '/1097api-v1.0/';
const telephoneServer = 'https://uatcz.piramalswasthya.org/'; // Czentrix — out of scope, stubbed
const siteKey = '';
const captchaChallengeURL = '';
const enableCaptcha = false;

export const environment = {
  production: false,
  invalidCallType: 'Invalid',
  encKey: sessionStorageEncKey,
  commonAPI,
  ip1097: API1097,
  adminAPI,
  telephoneServer,
  siteKey,
  captchaChallengeURL,
  enableCaptcha,
  useApimanKey: true,
  sessionTimeoutMinutes: 27,
};
