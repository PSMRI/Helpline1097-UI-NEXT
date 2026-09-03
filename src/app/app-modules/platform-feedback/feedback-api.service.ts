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

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { skipLoader } from '@/app-modules/core/http/http-context';

/** Old `ServiceLine` union — the platform's service lines. */
export type ServiceLine = '1097' | '104' | 'AAM' | 'MMU' | 'TM' | 'ECD';

/** Old `CategoryDto` (raw response items — this API does NOT use the AMRIT envelope). */
export interface CategoryDto {
  categoryID: string;
  slug: string;
  label: string;
  scope: 'GLOBAL' | ServiceLine;
  active: boolean;
}

/** Old `SubmitFeedbackRequest` (+ the conditional `userId` the dialog appends). */
export interface SubmitFeedbackRequest {
  rating: number;
  categorySlug: string;
  comment?: string;
  isAnonymous: boolean;
  serviceLine: ServiceLine;
  userId?: number | string;
}

/**
 * Public platform-feedback endpoints (old `FeedbackService`). Two deliberate oddities kept:
 *  - URLs are built from `window.location.origin` (NOT the environment base) — the old page
 *    was served under any service line's host and always talked to its own origin;
 *  - responses are RAW (an array / `{id}`), not the `{data, statusCode}` envelope, and the
 *    old service used the bare Http client, so no auth header — the interceptor's
 *    platform-feedback bypass reproduces that.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = `${window.location.origin}/common-api`;

  /** GET platform-feedback/categories?serviceLine= — raw CategoryDto[]. */
  listCategories(serviceLine: ServiceLine): Observable<CategoryDto[]> {
    return this.http.get<CategoryDto[]>(
      `${this.apiBase}/platform-feedback/categories?serviceLine=${encodeURIComponent(serviceLine || '')}`,
      { context: skipLoader() },
    );
  }

  /** POST platform-feedback — raw `{id, createdAt?}`. */
  submitFeedback(payload: SubmitFeedbackRequest): Observable<{ id: string; createdAt?: string }> {
    return this.http.post<{ id: string; createdAt?: string }>(
      `${this.apiBase}/platform-feedback`,
      payload,
      { context: skipLoader() },
    );
  }
}
