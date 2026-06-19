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

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '../services/config.service';

/**
 * Appends the APIMAN `apikey` query param, ported from `updateUrl()` in the old wrappers
 * (which read `apiman_key` from PLAIN sessionStorage).
 */
export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const apiKey = inject(AuthService).getApiKey();
  const config = inject(ConfigService);
  if (config.useApimanKey && apiKey) {
    const separator = req.url.includes('?') ? '&' : '?';
    req = req.clone({ url: `${req.url}${separator}apikey=${apiKey}` });
  }
  return next(req);
};
