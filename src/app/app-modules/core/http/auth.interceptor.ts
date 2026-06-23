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
import { SKIP_AUTH } from './http-context';

/**
 * Faithful port of the old wrappers' header logic: ALWAYS send `Content-Type:
 * application/json` and an `Authorization` header on every request, so the request shape
 * the backend receives is unchanged. The token is read PLAIN (as the old app did); the
 * Authorization value is empty for the public platform-feedback endpoints (old `skipAuth`
 * rule) or when not logged in.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH)) {
    return next(req);
  }
  const token = inject(AuthService).getToken();
  const isPublic = req.url.includes('platform-feedback');
  const authValue = !isPublic && token ? token : '';

  const headers = req.headers
    .set('Content-Type', 'application/json')
    .set('Authorization', authValue);
  return next(req.clone({ headers }));
};
