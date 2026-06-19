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

import { Injectable } from '@angular/core';
import { environment } from '@env/environment';

/**
 * Central API/base-URL config, sourced from the active environment file.
 * Ported from the old ConfigService. Note: in the old app `openCommon` == `common`
 * (same base) — the open-vs-authenticated distinction is per-endpoint, not per-base.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  readonly commonBaseURL = environment.commonAPI;
  readonly openCommonBaseURL = environment.commonAPI;
  readonly helpline1097BaseURL = environment.ip1097;
  readonly adminBaseURL = environment.adminAPI;
  readonly telephonyServerURL = environment.telephoneServer;

  readonly useApimanKey = environment.useApimanKey;
  readonly sessionTimeoutMinutes = environment.sessionTimeoutMinutes;
  readonly enableCaptcha = environment.enableCaptcha;
  readonly siteKey = environment.siteKey;
  readonly captchaChallengeURL = environment.captchaChallengeURL;

  readonly localeString = 'en-in';
  readonly defaultWrapupTime = 120;
}
