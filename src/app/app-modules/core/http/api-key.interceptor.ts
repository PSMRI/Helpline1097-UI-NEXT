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

/**
 * Appends the APIMAN `apikey` query param, a faithful port of `updateUrl()` from the old
 * wrappers: append it whenever `apiman_key` exists in (PLAIN) sessionStorage.
 */
export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const apiKey = inject(AuthService).getApiKey();
  if (apiKey) {
    req = req.clone({ url: `${req.url}?apikey=${apiKey}` });
  }
  return next(req);
};
