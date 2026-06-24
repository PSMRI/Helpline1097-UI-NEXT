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

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiResponse } from '../models';

/**
 * Czentrix telephony (CTI) abstraction. Out of scope for now (per mentor): provided as an
 * abstract token with a success-shaped stub so screens that depend on CTI compile and run.
 * Swap the provider for the real REST integration (the old czentrix.service) later.
 */
export abstract class CtiService {
  abstract getLoginKey(username: string, password: string): Observable<ApiResponse>;
  abstract getAgentStatus(): Observable<ApiResponse>;
  abstract getIvrsPathDetails(): Observable<ApiResponse>;
  abstract getCallDetails(): Observable<ApiResponse>;
  abstract dialBeneficiary(phoneNumber: string): Observable<ApiResponse>;
  abstract agentLogout(): Observable<ApiResponse>;
  abstract userLogout(): Observable<ApiResponse>;
  abstract getIpAddress(): Observable<ApiResponse>;
  abstract setCustomerPreferredLanguage(data: unknown): Observable<ApiResponse>;
}

@Injectable()
export class CzentrixStubService extends CtiService {
  private ok(): Observable<ApiResponse> {
    return of({ statusCode: 200, data: null });
  }

  getLoginKey(): Observable<ApiResponse> {
    return this.ok();
  }
  getAgentStatus(): Observable<ApiResponse> {
    return this.ok();
  }
  getIvrsPathDetails(): Observable<ApiResponse> {
    return this.ok();
  }
  getCallDetails(): Observable<ApiResponse> {
    return this.ok();
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
}
