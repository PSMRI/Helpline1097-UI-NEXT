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

import { ApiResponse } from '../models';
import { ConfigService } from './config.service';

/** `saveComplaintResolution` request (old grievance-resolution-details `feedbackObj`). */
export interface ComplaintResolutionRequest {
  complaintID?: number | string | null;
  complaintResolution?: string | null;
  remarks?: string | null;
  beneficiaryRegID?: number | string | null;
  providerServiceMapID?: number | null;
  userID?: number | string | null;
  createdBy?: string;
  benCallID?: number | string | null;
}

/**
 * Outbound-call API — Phase 6f slice of the old `callservice`/`co_feedback` outbound
 * methods used by the everwell & grievance in-wizard slides. Endpoint URLs + payloads are
 * byte-faithful. The broader outbound-worklist/reallocation surface (list fetch, dial,
 * move-to-bin) belongs with the supervisor/outbound screens in a later phase.
 */
@Injectable({ providedIn: 'root' })
export class OutboundApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** POST saveComplaintResolution — grievance resolution submit. */
  saveComplaintResolution(request: ComplaintResolutionRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}saveComplaintResolution`,
      request,
    );
  }

  /** POST completeGrievanceCall — mark a grievance outbound call complete. */
  completeGrievanceCall(request: Record<string, unknown>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}completeGrievanceCall`,
      request,
    );
  }

  /** POST everwellCall/saveFeedback — Everwell per-dose feedback save. */
  saveEverwellFeedback(request: Record<string, unknown>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}everwellCall/saveFeedback`,
      request,
    );
  }

  /** POST everwellCall/completeOutboundCall — mark an Everwell outbound call complete. */
  completeEverwellOutboundCall(request: unknown[]): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}everwellCall/completeOutboundCall`,
      request,
    );
  }

  /** POST getGrievanceOutboundWorklist — the agent's allocated grievance complaints. */
  getGrievanceOutboundWorklist(
    providerServiceMapID: number,
    userId: number | string,
  ): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}getGrievanceOutboundWorklist`,
      { providerServiceMapID, userId },
    );
  }

  /** POST everwellCall/outboundCallList — the agent's allocated Everwell records. */
  getEverwellOutboundWorklist(
    providerServiceMapId: number,
    agentId: number | string,
  ): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}everwellCall/outboundCallList`,
      { providerServiceMapId, agentId },
    );
  }

  /** POST everwellCall/checkIfAlreadyCalled — pre-dial guard (`.data.isCompleted`). */
  checkIfAlreadyCalled(
    eapiId: number | string,
    providerServiceMapId: number,
  ): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}everwellCall/checkIfAlreadyCalled`,
      { eapiId, providerServiceMapId },
    );
  }

  /** POST everwellCall/outboundCallListWithMobileNumber — beneficiaries on a phone number. */
  everwellBeneficiariesByPhone(
    providerServiceMapId: number,
    primaryNumber: string,
  ): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}everwellCall/outboundCallListWithMobileNumber`,
      { providerServiceMapId, PrimaryNumber: primaryNumber },
    );
  }
}
