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

import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Per-request flags. The old app expressed "don't show the loader" by routing a call through
 * `AuthorizationWrapper` (no loader) instead of `InterceptedHttp` (loader). With functional
 * interceptors that distinction becomes a context flag the loader interceptor respects, e.g.
 * background/polling calls use `{ context: skipLoader() }`.
 */
export const SKIP_LOADER = new HttpContextToken<boolean>(() => false);
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

export function skipLoader(context: HttpContext = new HttpContext()): HttpContext {
  return context.set(SKIP_LOADER, true);
}

export function skipAuth(context: HttpContext = new HttpContext()): HttpContext {
  return context.set(SKIP_AUTH, true);
}
