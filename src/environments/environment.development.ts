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

// Development environment.
// Base URLs are origin-relative ('/') so all API calls are same-origin and routed
// through proxy.conf.js to the shared dev backend (https://amritwprdev.piramalswasthya.org).
// Align these prefixes with the proxy `context` list as endpoints are wired in Phase 1/3.
export const environment = {
  production: false,
  invalidCallType: 'Invalid',
  encKey: 'helpline1097-dev-enc-key',
  commonAPI: '/',
  ip1097: '/',
  telephoneServer: '/', // Czentrix telephony — out of scope for now (stubbed)
  adminAPI: '/',
  siteKey: '',
  captchaChallengeURL: '',
  enableCaptcha: false,
};
