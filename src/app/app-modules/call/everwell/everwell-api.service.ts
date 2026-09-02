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

/** A family-member row from `outboundCallListWithMobileNumber` (backend casing verbatim). */
export interface EverwellFamilyRow {
  Id?: number | string;
  eapiId?: number | string;
  beneficiaryID?: number | string;
  beneficiaryRegId?: number | string;
  providerServiceMapId?: number;
  agentId?: number | string;
  FirstName?: string;
  LastName?: string;
  Gender?: string;
  State?: string;
  District?: string;
  PrimaryNumber?: string;
  comments?: unknown;
  lastCall?: unknown;
  callCounter?: number;
  AdherencePercentage?: unknown;
  MissedDoses?: unknown;
  CurrentMonthMissedDoses?: unknown;
  NoInfoDoseCount?: unknown;
  noInfoDosesDates?: string | null;
  createdBy?: string;
  [key: string]: unknown;
}

/** One saved support-action feedback (getEverwellfeedbackDetails → data.feedbackDetails). */
export interface EverwellFeedbackRow {
  efid?: number | string;
  dateOfAction?: string;
  category?: string;
  subCategory?: string;
  actionTaken?: string;
  comments?: string;
  secondaryPhoneNo?: string;
  [key: string]: unknown;
}

/** Context for one closure-time completion batch (closure supplies these). */
export interface EverwellCompletionContext {
  userId: number | string | null;
  callId: string | null;
  callTypeID: unknown;
  benCallID: unknown;
  providerServiceMapID: unknown;
  createdBy: string | undefined;
}

/**
 * Old closure everwell branch: ONE completion entry per family member touched by a saved
 * feedback, keys in the old `outboundObj` insertion order (note the mixed casing —
 * `beneficiaryRegId` vs grievance's `beneficiaryRegID`, and `providerServiceMapId`).
 */
export function buildEverwellCompletionEntries(
  touched: Record<string, unknown>[],
  ctx: EverwellCompletionContext,
): Record<string, unknown>[] {
  return touched.map((member) => ({
    eapiId: member['eapiId'],
    assignedUserID: ctx.userId,
    isCompleted: true,
    beneficiaryRegId: member['beneficiaryRegId'],
    callTypeID: ctx.callTypeID,
    benCallID: ctx.benCallID,
    callId: ctx.callId,
    providerServiceMapId: ctx.providerServiceMapID,
    requestedServiceID: null,
    preferredLanguageName: 'All',
    createdBy: ctx.createdBy,
  }));
}

/**
 * Everwell in-call endpoints (old `OutboundReAllocationService` everwell trio +
 * `CallServices.saveEverwellFeedback`/`closeEverwellOutBoundCall`). All POST. The old
 * `postEverwell` interceptor variant was a plain authenticated POST — no special handling.
 */
@Injectable({ providedIn: 'root' })
export class EverwellApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** POST everwellCall/outboundCallListWithMobileNumber — family members on the dialed number. */
  familyOnPhoneNumber(
    providerServiceMapId: number | undefined,
    primaryNumber: string | undefined,
  ): Observable<ApiResponse<EverwellFamilyRow[]>> {
    return this.http.post<ApiResponse<EverwellFamilyRow[]>>(
      `${this.config.commonBaseURL}everwellCall/outboundCallListWithMobileNumber`,
      { providerServiceMapId, PrimaryNumber: primaryNumber },
    );
  }

  /** POST everwellCall/getEverwellfeedbackDetails — prior support actions for one member. */
  getFeedbackDetails(id: number | string | undefined): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}everwellCall/getEverwellfeedbackDetails`,
      { Id: id },
    );
  }

  /**
   * POST ip1097 fetchEverwellGuidelines — the guideline PDF matching the member's adherence
   * band. The envelope is DOUBLE-nested (`res.data.data` is the array), exactly like the
   * supervisor upload page's list call (live-verified in Phase 8).
   */
  fetchGuidelines(adherencePercentage: unknown, providerServiceMapID: number | undefined): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.helpline1097BaseURL}fetchEverwellGuidelines`, {
      adherencePercentage,
      providerServiceMapID,
    });
  }

  /** POST everwellCall/saveFeedback — create/update one support action (data has `.savedData`). */
  saveFeedback(payload: Record<string, unknown>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}everwellCall/saveFeedback`,
      payload,
    );
  }

  /** POST everwellCall/completeOutboundCall — one entry PER touched family member. */
  completeOutboundCall(entries: Record<string, unknown>[]): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}everwellCall/completeOutboundCall`,
      entries,
    );
  }
}
