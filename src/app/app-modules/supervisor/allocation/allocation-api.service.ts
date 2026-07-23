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

export type AllocationFlavor = 'generic' | 'grievance' | 'everwell';

/** Per-language count row (`{language, count}`) returned by every count endpoint. */
export interface LanguageCountRow {
  language?: string;
  count?: number;
  [key: string]: unknown;
}

/**
 * Old app's UTC-offset-shifted day boundary strings (`toJSON().slice(0,10) + "T…Z"`) —
 * the exact query-window format every allocation screen posted.
 */
export function dayBoundary(date: Date, edge: 'start' | 'end' | 'end999'): string {
  const day = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
    .toJSON()
    .slice(0, 10);
  return edge === 'start'
    ? `${day}T00:00:00.000Z`
    : edge === 'end'
      ? `${day}T23:59:59.000Z`
      : `${day}T23:59:59.999Z`;
}

/**
 * Allocation/reallocation endpoints for the three outbound flavors (old
 * OutboundCallAllocationService / OutboundSearchRecordService / OutboundReAllocationService).
 * Bodies are byte-faithful — note the everwell `providerServiceMapId`/`agentId` casing and
 * the grievance `touserID`/`fromUserId` keys.
 */
@Injectable({ providedIn: 'root' })
export class AllocationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private post(path: string, body: unknown): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}${path}`, body);
  }

  /** POST user/getRolesByProviderID. */
  getRoles(providerServiceMapID: number): Observable<ApiResponse> {
    return this.post('user/getRolesByProviderID', { providerServiceMapID });
  }

  /** POST user/getUsersByProviderID — RoleID/languageName only when present (old body). */
  getAgents(
    providerServiceMapID: number,
    roleID?: number | string,
    languageName?: string,
  ): Observable<ApiResponse> {
    const body: Record<string, unknown> = { providerServiceMapID };
    if (roleID) {
      body['RoleID'] = roleID;
    }
    if (languageName) {
      body['languageName'] = languageName;
    }
    return this.post('user/getUsersByProviderID', body);
  }

  /** Unallocated per-language counts for a date window. */
  countUnallocated(
    flavor: AllocationFlavor,
    providerServiceMapID: number,
    filterStartDate: string,
    filterEndDate: string,
    preferredLanguageName?: string,
  ): Observable<ApiResponse> {
    if (flavor === 'everwell') {
      return this.post('everwellCall/outboundCallCount', {
        providerServiceMapId: providerServiceMapID,
        filterStartDate,
        filterEndDate,
        preferredLanguageName,
      });
    }
    const body = { providerServiceMapID, filterStartDate, filterEndDate, preferredLanguageName };
    return this.post(
      flavor === 'grievance' ? 'unallocatedGrievanceCount' : 'call/outboundCallCount',
      body,
    );
  }

  /** An agent's per-language counts (reallocation screens). */
  countByAgent(
    flavor: AllocationFlavor,
    providerServiceMapID: number,
    userID: number | string,
    filterStartDate?: string,
    filterEndDate?: string,
  ): Observable<ApiResponse> {
    if (flavor === 'grievance') {
      return this.post('allocatedGrievanceRecordsCount', { providerServiceMapID, userID });
    }
    if (flavor === 'everwell') {
      return this.post('everwellCall/outboundCallCount', {
        providerServiceMapId: providerServiceMapID,
        agentId: userID,
      });
    }
    const body: Record<string, unknown> = { providerServiceMapID, assignedUserID: userID };
    if (filterStartDate) {
      body['filterStartDate'] = filterStartDate;
    }
    if (filterEndDate) {
      body['filterEndDate'] = filterEndDate;
    }
    return this.post('call/outboundCallCount', body);
  }

  /**
   * The records to allocate — date-window scoped (allocation) or agent-scoped
   * (reallocation; the old service dropped the date fields on the agent branch).
   */
  listRecords(
    flavor: AllocationFlavor,
    providerServiceMapID: number,
    options: {
      filterStartDate?: string;
      filterEndDate?: string;
      preferredLanguageName?: string;
      assignedUserID?: number | string;
    },
  ): Observable<ApiResponse> {
    if (flavor === 'everwell') {
      const body: Record<string, unknown> = { providerServiceMapId: providerServiceMapID };
      if (options.assignedUserID) {
        body['agentId'] = options.assignedUserID;
        body['preferredLanguageName'] = options.preferredLanguageName;
      } else {
        body['filterStartDate'] = options.filterStartDate;
        body['filterEndDate'] = options.filterEndDate;
        body['preferredLanguageName'] = options.preferredLanguageName;
      }
      return this.post('everwellCall/outboundCallList', body);
    }
    const body: Record<string, unknown> = { providerServiceMapID, is1097: true };
    if (options.assignedUserID) {
      body['assignedUserID'] = options.assignedUserID;
      body['preferredLanguageName'] = options.preferredLanguageName;
    } else {
      body['filterStartDate'] = options.filterStartDate;
      body['filterEndDate'] = options.filterEndDate;
      body['preferredLanguageName'] = options.preferredLanguageName;
    }
    return this.post('call/outboundCallList', body);
  }

  /** Raw list post for the move-to-bin path (the old code posted its reqObj verbatim). */
  listForBin(flavor: AllocationFlavor, body: Record<string, unknown>): Observable<ApiResponse> {
    return this.post(
      flavor === 'everwell' ? 'everwellCall/outboundCallList' : 'call/outboundCallList',
      body,
    );
  }

  /** POST call/outboundAllocation — old body = the whole allocate form. */
  allocateGeneric(body: {
    roleID: number | string;
    userID: (number | string)[];
    allocateNo: number;
    outboundCallRequests: unknown[] | null;
  }): Observable<ApiResponse> {
    return this.post('call/outboundAllocation', body);
  }

  /** POST everwellCall/outboundAllocation — everwell uses the `agentId` key. */
  allocateEverwell(body: {
    roleID: number | string;
    agentId: (number | string)[];
    allocateNo: number;
    outboundCallRequests: unknown[] | null;
  }): Observable<ApiResponse> {
    return this.post('everwellCall/outboundAllocation', body);
  }

  /** POST allocateGrievances / reallocateGrievances (isAllocate picks the endpoint). */
  allocateGrievance(body: Record<string, unknown>, isAllocate: boolean): Observable<ApiResponse> {
    return this.post(isAllocate ? 'allocateGrievances' : 'reallocateGrievances', body);
  }

  /** Move an agent's records back to the unallocated bin. */
  moveToBin(
    flavor: AllocationFlavor,
    body: Record<string, unknown>,
  ): Observable<ApiResponse> {
    const path =
      flavor === 'grievance'
        ? 'moveToBin'
        : flavor === 'everwell'
          ? 'everwellCall/resetOutboundCall'
          : 'call/resetOutboundCall';
    return this.post(path, body);
  }
}
