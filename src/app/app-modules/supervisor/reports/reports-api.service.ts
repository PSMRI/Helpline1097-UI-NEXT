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
import { ValidatorFn } from '@angular/forms';
import { Observable } from 'rxjs';

import { localDate } from '../allocation/allocation-api.service';
import { ApiResponse, CallTypeGroup } from '@/app-modules/core/models';
import { ConfigService } from '@/app-modules/core/services/config.service';

/** Trigger a browser download for a server-produced report blob (old `saveAs`). */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // Revoking before the download starts can abort it; FileSaver kept the URL alive ~40s.
  setTimeout(() => URL.revokeObjectURL(url), 40000);
}

/** Yesterday at local midnight — the reports' max selectable day (old `maxStartDate`). */
export function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDayString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** `yesterday()` as a yyyy-MM-dd string for native date-input `max`. */
export function maxReportDay(): string {
  return toDayString(yesterday());
}

/**
 * Old `endDateChange`: the window ends at yesterday, capped to start+30 days when the start
 * is 31+ days before yesterday. The result is both the auto-filled end date and its `max`.
 */
export function clampReportEnd(start: string): string {
  const startDay = localDate(start);
  const spanDays = Math.ceil((yesterday().getTime() - startDay.getTime()) / 86400000);
  const end = new Date(startDay);
  if (spanDays > 30) {
    end.setDate(end.getDate() + 30);
  } else {
    end.setTime(yesterday().getTime());
  }
  return toDayString(end);
}

/**
 * Native date inputs' min/max don't feed reactive-form validity (the old md2-datepicker's
 * did, disabling Download on out-of-range dates) — so re-validate the window here.
 */
export function reportDatesValidator(maxDay: string, maxEnd: () => string): ValidatorFn {
  return (group) => {
    const start = group.get('startDate')?.value as string | null;
    const end = group.get('endDate')?.value as string | null;
    if (start && start > maxDay) {
      return { startOutOfRange: true };
    }
    if (end && (end > maxEnd() || (start != null && end < start))) {
      return { endOutOfRange: true };
    }
    return null;
  };
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
