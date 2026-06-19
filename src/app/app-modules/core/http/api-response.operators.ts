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

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../models';

/**
 * Unwraps the `{ statusCode, data, errorMessage }` envelope to just `data` — the explicit
 * replacement for the old services' `.map(res => res.json().data)`. Services pipe this
 * instead of unwrapping inline, keeping blob/non-envelope responses out of the path.
 */
export function unwrapData<T>() {
  return (source: Observable<ApiResponse<T>>): Observable<T> =>
    source.pipe(map((response) => response.data));
}
