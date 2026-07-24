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

import { ApiResponse, CallTypeGroup } from '@/app-modules/core/models';
import { ConfigService } from '@/app-modules/core/services/config.service';

/** Trigger a browser download for a server-produced report blob (old `saveAs`). */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Yesterday at local midnight — the reports' max selectable day (old `maxStartDate`). */
export function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * `crmReports/*` XLSX downloads. The old ReportsService bypassed its interceptors with a
 * construction-time token (stale-token bug); ours goes through the normal chain — the
 * response interceptor passes non-envelope bodies (blobs) untouched.
 */
@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  downloadReport(path: string, body: Record<string, unknown>): Observable<Blob> {
    return this.http.post(`${this.config.commonBaseURL}${path}`, body, {
      responseType: 'blob',
    });
  }

  /** POST call/getCallTypesV1 with the report's plain body (no campaign flags). */
  getCallTypes(providerServiceMapID: number): Observable<ApiResponse<CallTypeGroup[]>> {
    return this.http.post<ApiResponse<CallTypeGroup[]>>(
      `${this.config.commonBaseURL}call/getCallTypesV1`,
      { providerServiceMapID },
    );
  }
}
