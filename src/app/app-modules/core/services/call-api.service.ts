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

import {
  ApiResponse,
  CallData,
  CallSummary,
  CallTypeGroup,
  CloseCallRequest,
  RoleWrapupTimeData,
  StartCallRequest,
  SubServiceType,
  TransferCallRequest,
} from '../models';
import { ConfigService } from './config.service';

/**
 * Call-domain API — port of the old `callservice.service` (+ the call-linkage slice of
 * `register-service`). Endpoint URLs and payloads are byte-faithful. Phase 5 added
 * getCallTypes/closeCall/wrap-up; Phase 6 adds startCall, updatebeneficiaryincall,
 * getCallSummary (the ONLY endpoint on the 1097 base URL), transfer/campaign, service
 * types, languages and outbound-completion. Everwell/grievance closures arrive with
 * their worklists (Phase 6f).
 */
@Injectable({ providedIn: 'root' })
export class CallApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /**
   * POST call/getCallTypesV1 — call-type groups for the service. Old innerpage payload:
   * `{providerServiceMapID}` plus `isInbound: true` when the current campaign is INBOUND,
   * otherwise `isOutbound: true`.
   */
  getCallTypes(
    providerServiceMapID: number,
    currentCampaign: string | null,
  ): Observable<ApiResponse<CallTypeGroup[]>> {
    const request: Record<string, unknown> = { providerServiceMapID };
    if (currentCampaign === 'INBOUND') {
      request['isInbound'] = true;
    } else {
      request['isOutbound'] = true;
    }
    return this.http.post<ApiResponse<CallTypeGroup[]>>(
      `${this.config.commonBaseURL}call/getCallTypesV1`,
      request,
    );
  }

  /** POST call/closeCall — close/dispose the active call (see `CloseCallRequest`). */
  closeCall(request: CloseCallRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}call/closeCall`, request);
  }

  /** GET user/role/{roleID} — role-based wrap-up time (`data.isWrapUpTime`/`data.WrapUpTime`). */
  getRoleBasedWrapupTime(roleId: number): Observable<ApiResponse<RoleWrapupTimeData>> {
    return this.http.get<ApiResponse<RoleWrapupTimeData>>(
      `${this.config.commonBaseURL}user/role/${roleId}`,
    );
  }

  /**
   * POST call/startCall — open the call record; the response's `benCallID` links every
   * later save. The old register-service forced `is1097: true, isCalledEarlier: false`.
   */
  startCall(request: StartCallRequest): Observable<ApiResponse<CallData>> {
    return this.http.post<ApiResponse<CallData>>(`${this.config.commonBaseURL}call/startCall`, {
      ...request,
      is1097: true,
      isCalledEarlier: false,
    });
  }

  /** POST call/updatebeneficiaryincall — attach the selected beneficiary to the open call. */
  updateBeneficiaryInCall(callData: Record<string, unknown>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}call/updatebeneficiaryincall`,
      { ...callData, is1097: true },
    );
  }

  /** POST {1097}services/getCallSummary — per-call service summary (1097 base URL!). */
  getCallSummary(benCallID: number | string): Observable<ApiResponse<CallSummary[]>> {
    return this.http.post<ApiResponse<CallSummary[]>>(
      `${this.config.helpline1097BaseURL}services/getCallSummary`,
      { benCallID },
    );
  }

  /** POST service/servicetypes — sub-services of the service (same payload as getCallTypes). */
  getSubServiceTypes(
    providerServiceMapID: number,
    currentCampaign: string | null,
  ): Observable<ApiResponse<SubServiceType[]>> {
    const request: Record<string, unknown> = { providerServiceMapID };
    if (currentCampaign === 'INBOUND') {
      request['isInbound'] = true;
    } else {
      request['isOutbound'] = true;
    }
    return this.http.post<ApiResponse<SubServiceType[]>>(
      `${this.config.commonBaseURL}service/servicetypes`,
      request,
    );
  }

  /** GET beneficiary/getLanguageList — language master (closure follow-up + allocation). */
  getLanguages(): Observable<ApiResponse> {
    return this.http.get<ApiResponse>(`${this.config.commonBaseURL}beneficiary/getLanguageList`);
  }

  /** POST cti/getCampaignNames — transfer-target campaigns (`data.campaign`). */
  getCampaignNames(serviceName: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}cti/getCampaignNames`, {
      serviceName,
    });
  }

  /** POST cti/getCampaignSkills — skills of a campaign (`data.response.skills`). */
  getCampaignSkills(campaignName: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}cti/getCampaignSkills`, {
      campaign_name: campaignName,
    });
  }

  /** POST cti/transferCall — transfer the live call to another campaign/skill. */
  transferCall(request: TransferCallRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}cti/transferCall`, request);
  }

  /** POST call/completeOutboundCall — mark an outbound work item completed. */
  completeOutboundCall(
    outboundCallReqID: number | string,
    isCompleted: boolean,
  ): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}call/completeOutboundCall`, {
      outboundCallReqID,
      isCompleted,
    });
  }

  /** POST call/getBenRequestedOutboundCall — a beneficiary's pending follow-up requests. */
  getBenRequestedOutboundCalls(
    beneficiaryRegID: number | string,
    calledServiceID: number,
  ): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}call/getBenRequestedOutboundCall`,
      { beneficiaryRegID, calledServiceID, is1097: true },
    );
  }
}
