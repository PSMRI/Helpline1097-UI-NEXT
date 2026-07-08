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
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

import { ApiResponse } from '../models';
import { skipAuth, skipLoader } from '../http/http-context';
import { ConfigService } from './config.service';
import { ENCRYPTED_KEYS, SessionStorageService } from './session-storage.service';
import { SessionStore } from '../state/session.store';

/**
 * Agent-status shape returned by `cti/getAgentState` (old innerpage/dashboardUserId readers:
 * `data.stateObj.stateName` + optional `stateType`, `dialer_type`).
 */
export interface AgentStateData {
  stateObj?: { stateName?: string; stateType?: string };
  dialer_type?: string;
}

/** Call-stats shape returned by `cti/getAgentCallStats` (old call-statistics reader). */
export interface AgentCallStatsData {
  total_calls?: number | string;
  total_invalid_calls?: number | string;
  total_call_duration?: number | string;
  total_break_time?: number | string;
  total_free_time?: number | string;
}

/**
 * Czentrix telephony (CTI) abstraction. Two providers:
 *  - `CzentrixHttpService` — the real REST integration (faithful port of the old
 *    `czentrix.service` + the campaign-switch calls from the old `callservice.service`).
 *  - `CzentrixStubService` — success-shaped stub kept for unit tests / CTI-less demos.
 */
export abstract class CtiService {
  abstract getLoginKey(username: string, password: string): Observable<ApiResponse>;
  abstract getAgentStatus(): Observable<ApiResponse<AgentStateData>>;
  abstract getIvrsPathDetails(): Observable<ApiResponse>;
  abstract getCallDetails(): Observable<ApiResponse<AgentCallStatsData>>;
  abstract dialBeneficiary(phoneNumber: string): Observable<ApiResponse>;
  abstract agentLogout(): Observable<ApiResponse>;
  abstract userLogout(): Observable<ApiResponse>;
  abstract getIpAddress(): Observable<ApiResponse>;
  abstract setCustomerPreferredLanguage(data: unknown): Observable<ApiResponse>;
  abstract switchToInbound(): Observable<ApiResponse>;
  abstract switchToOutbound(): Observable<ApiResponse>;
}

/**
 * Real CZentrix REST integration. Endpoint URLs, payloads (`{agent_id}`) and the response
 * envelope are byte-faithful to the old app; `agent_id` is the selected role's agent id
 * (old `dataService.cZentrixAgentID`, now `SessionStore.agentId`).
 */
@Injectable()
export class CzentrixHttpService extends CtiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly sessionStore = inject(SessionStore);
  private readonly storage = inject(SessionStorageService);

  private agentPayload(): { agent_id: number | string } {
    return { agent_id: this.sessionStore.agentId() ?? '' };
  }

  /**
   * GET the CTI login key straight from the telephony server. Faithful port note: the old
   * app defined this but never called it (the `cti_handler.php` iframe logs the agent into
   * CZentrix itself) — kept for parity. Skips auth/loader: the telephony server is not our
   * API and must not receive the Authorization header.
   */
  getLoginKey(username: string, password: string): Observable<ApiResponse> {
    const url =
      `${this.config.telephonyServerURL}apps/cust_appsHandler.php` +
      `?transaction_id=CTI_LOGIN_KEY&username=${username}&password=${password}&resFormat=3`;
    return this.http.get<ApiResponse>(url, { context: skipAuth(skipLoader()) });
  }

  /** POST cti/getAgentState — live agent state (`data.stateObj.stateName`). */
  getAgentStatus(): Observable<ApiResponse<AgentStateData>> {
    return this.http.post<ApiResponse<AgentStateData>>(
      `${this.config.commonBaseURL}cti/getAgentState`,
      this.agentPayload(),
    );
  }

  /** POST cti/getIVRSPathDetails — IVRS routing info (`data.zoneName`). */
  getIvrsPathDetails(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}cti/getIVRSPathDetails`,
      this.agentPayload(),
    );
  }

  /** POST cti/getAgentCallStats — today's call statistics for the agent. */
  getCallDetails(): Observable<ApiResponse<AgentCallStatsData>> {
    return this.http.post<ApiResponse<AgentCallStatsData>>(
      `${this.config.commonBaseURL}cti/getAgentCallStats`,
      this.agentPayload(),
    );
  }

  /** POST cti/callBeneficiary — outbound manual dial. */
  dialBeneficiary(phoneNumber: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}cti/callBeneficiary`, {
      ...this.agentPayload(),
      phone_num: phoneNumber,
    });
  }

  /** POST cti/doAgentLogout — CTI-level agent logout. */
  agentLogout(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.openCommonBaseURL}cti/doAgentLogout`,
      this.agentPayload(),
    );
  }

  /**
   * POST user/userLogout — app-level logout. The old czentrix service also cleared
   * `privilege_flag` / `session_id` / `callTransferred` here; kept faithful.
   */
  userLogout(): Observable<ApiResponse> {
    return this.http
      .post<ApiResponse>(`${this.config.openCommonBaseURL}user/userLogout`, {})
      .pipe(
        tap(() => {
          this.storage.removeItem(ENCRYPTED_KEYS.privilegeFlag);
          this.storage.removeItem(ENCRYPTED_KEYS.sessionId);
          this.storage.removeItem(ENCRYPTED_KEYS.callTransferred);
        }),
      );
  }

  /** POST cti/getAgentIPAddress (`data.agent_ip`). */
  getIpAddress(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}cti/getAgentIPAddress`,
      this.agentPayload(),
    );
  }

  /** POST cti/customerPreferredLanguage — per-call language preference. */
  setCustomerPreferredLanguage(data: unknown): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}cti/customerPreferredLanguage`,
      data,
    );
  }

  /** POST cti/switchToInbound — move the agent to the INBOUND campaign. */
  switchToInbound(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}cti/switchToInbound`,
      this.agentPayload(),
    );
  }

  /** POST cti/switchToOutbound — move the agent to the OUTBOUND (manual dial) campaign. */
  switchToOutbound(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}cti/switchToOutbound`,
      this.agentPayload(),
    );
  }
}

@Injectable()
export class CzentrixStubService extends CtiService {
  private ok<T = unknown>(): Observable<ApiResponse<T>> {
    return of({ statusCode: 200, data: null as T });
  }

  getLoginKey(): Observable<ApiResponse> {
    return this.ok();
  }
  getAgentStatus(): Observable<ApiResponse<AgentStateData>> {
    return this.ok<AgentStateData>();
  }
  getIvrsPathDetails(): Observable<ApiResponse> {
    return this.ok();
  }
  getCallDetails(): Observable<ApiResponse<AgentCallStatsData>> {
    return this.ok<AgentCallStatsData>();
  }
  dialBeneficiary(): Observable<ApiResponse> {
    return this.ok();
  }
  agentLogout(): Observable<ApiResponse> {
    return this.ok();
  }
  userLogout(): Observable<ApiResponse> {
    return this.ok();
  }
  getIpAddress(): Observable<ApiResponse> {
    return this.ok();
  }
  setCustomerPreferredLanguage(): Observable<ApiResponse> {
    return this.ok();
  }
  switchToInbound(): Observable<ApiResponse> {
    return this.ok();
  }
  switchToOutbound(): Observable<ApiResponse> {
    return this.ok();
  }
}
