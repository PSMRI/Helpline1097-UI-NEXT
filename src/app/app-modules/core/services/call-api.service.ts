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

import { ApiResponse, CallTypeGroup, CloseCallRequest, RoleWrapupTimeData } from '../models';
import { ConfigService } from './config.service';

/**
 * Call-domain API — Phase 5 slice of the old `callservice.service` (getCallTypes,
 * closeCall, role wrap-up time). Endpoint URLs and payloads are byte-faithful; the
 * remaining old callservice methods (outbound worklists, blacklist, transfer, campaign
 * names/skills, everwell/grievance closures) arrive with their screens in Phases 6-7.
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
}
