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

/**
 * Force-logout of another agent (CO-only header action). Ports the old
 * `forceLogoutService.agentForceLogout` → POST `user/userForceLogout`.
 */
@Injectable({ providedIn: 'root' })
export class ForceLogoutService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  agentForceLogout(
    userName: string,
    password: string,
    providerServiceMapID: number | null,
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.config.commonBaseURL}user/userForceLogout`, {
      userName,
      password,
      providerServiceMapID,
    });
  }
}
