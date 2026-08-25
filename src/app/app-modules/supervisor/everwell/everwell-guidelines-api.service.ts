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

import { ApiResponse } from '@/app-modules/core/models';
import { ConfigService } from '@/app-modules/core/services/config.service';

/**
 * Everwell Guidelines Upload endpoints (supervisor page 28). All three resolve against the
 * 1097 base (`ip1097`) with NO path prefix, byte-faithful to the old
 * `everwell-guidelines-upload` screen. `save` posts a SINGLE object (not an array).
 */
@Injectable({ providedIn: 'root' })
export class EverwellGuidelinesApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private ip1097(path: string, body: unknown): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.helpline1097BaseURL}${path}`, body);
  }

  /** POST ip1097 fetchEverwellGuidelines — list for the current service. */
  fetchGuidelines(providerServiceMapID: number): Observable<ApiResponse> {
    return this.ip1097('fetchEverwellGuidelines', { providerServiceMapID });
  }

  /** POST ip1097 saveEverwellGuidelines — a single guideline object (with base64 file content). */
  saveGuidelines(body: Record<string, unknown>): Observable<ApiResponse> {
    return this.ip1097('saveEverwellGuidelines', body);
  }

  /** POST ip1097 deleteEverwellGuidelines — soft-delete (`deleted: true`). */
  deleteGuidelines(body: Record<string, unknown>): Observable<ApiResponse> {
    return this.ip1097('deleteEverwellGuidelines', body);
  }
}
