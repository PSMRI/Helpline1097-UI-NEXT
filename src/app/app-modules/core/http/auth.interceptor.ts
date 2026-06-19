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
 * Attaches the `Authorization` token (read PLAIN, as the old app did) and the JSON
 * Content-Type. Skips the header for the public platform-feedback endpoints (old
 * `skipAuth` rule) and for FormData bodies (so multipart uploads keep their boundary).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH)) {
    return next(req);
  }
  const token = inject(AuthService).getToken();
  const isPublic = req.url.includes('platform-feedback');
  const isFormData = req.body instanceof FormData;

  let headers = req.headers;
  if (!isFormData && !headers.has('Content-Type')) {
    headers = headers.set('Content-Type', 'application/json');
  }
  if (!isPublic && token) {
    headers = headers.set('Authorization', token);
  }
  return next(req.clone({ headers }));
};
