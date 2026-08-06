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

/**
 * Shift a Date so its UTC wall-clock equals its local wall-clock, then serialise — the exact
 * `new Date(d.valueOf() - d.getTimezoneOffset()*60000)` the old supervisor screens applied
 * before posting date-window filters (the codebase's "fake-UTC" shift). Returns an ISO string.
 */
export function tzShift(date: Date): string {
  return new Date(date.valueOf() - date.getTimezoneOffset() * 60000).toISOString();
}

/**
 * Supervisor Configuration-tools endpoints (old config screens): Blacklist a Number,
 * Call Auditing (quality audit — read-only), Force Logout, Knowledge Management and
 * SMS Templates. Bodies are byte-faithful to the old app, including the misspelled
 * `nueisanceCallHistory` path and the `calledServiceID`/`RoleID` key casings.
 */
@Injectable({ providedIn: 'root' })
export class ConfigApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private common(path: string, body: unknown): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}${path}`, body);
  }

  private admin(path: string, body: unknown): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.adminBaseURL}${path}`, body);
  }

  private ip1097(path: string, body: unknown): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.helpline1097BaseURL}${path}`, body);
  }

  // ---- Force Logout (23) ---------------------------------------------------
  /** POST commonAPI user/forceLogout — providerServiceMapID sourced from current service. */
  forceLogout(userName: string, providerServiceMapID: number): Observable<ApiResponse> {
    return this.common('user/forceLogout', { userName, providerServiceMapID });
  }

  // ---- Blacklist a Number (3) ----------------------------------------------
  /** POST call/getBlacklistNumbers — phoneNo omitted when not searching. */
  getBlacklistNumbers(
    providerServiceMapID: number,
    phoneNo?: number,
  ): Observable<ApiResponse> {
    const body: Record<string, unknown> = { providerServiceMapID, is1097: true };
    if (phoneNo !== undefined) {
      body['phoneNo'] = phoneNo;
    }
    return this.common('call/getBlacklistNumbers', body);
  }

  /** POST call/blockPhoneNumber. */
  blockPhoneNumber(phoneBlockID: number): Observable<ApiResponse> {
    return this.common('call/blockPhoneNumber', { phoneBlockID, is1097: true });
  }

  /** POST call/unblockPhoneNumber. */
  unblockPhoneNumber(phoneBlockID: number): Observable<ApiResponse> {
    return this.common('call/unblockPhoneNumber', { phoneBlockID, is1097: true });
  }

  /** POST call/nueisanceCallHistory (backend's misspelling — kept byte-faithful). */
  nuisanceCallHistory(
    calledServiceID: number,
    phoneNo: number,
    count: number,
  ): Observable<ApiResponse> {
    return this.common('call/nueisanceCallHistory', {
      calledServiceID,
      phoneNo,
      count,
      is1097: true,
    });
  }

  /** POST call/getFilePathCTI — call-recording file path (shared by Blacklist + Call Auditing). */
  getFilePathCTI(agentID: number | string, callID: number | string): Observable<ApiResponse> {
    return this.common('call/getFilePathCTI', { agentID, callID });
  }

  // ---- Knowledge Management (10) -------------------------------------------
  /** POST service/servicetypes — sub-services for the KM taxonomy. */
  getServiceTypes(providerServiceMapID: number): Observable<ApiResponse> {
    return this.common('service/servicetypes', { providerServiceMapID });
  }

  /** POST ip1097 api/helpline1097/co/get/categoryByID — categories for a sub-service. */
  getCategoryByID(subServiceID: number): Observable<ApiResponse> {
    return this.ip1097('api/helpline1097/co/get/categoryByID', { subServiceID });
  }

  /** POST service/subcategory — subcategories (+ previously-uploaded file link) for a category. */
  getSubcategory(categoryID: number): Observable<ApiResponse> {
    return this.common('service/subcategory', { categoryID });
  }

  /** POST kmfilemanager/addFile — body is an ARRAY of one file object (old app JSON-stringified). */
  addFile(body: unknown[]): Observable<ApiResponse> {
    return this.common('kmfilemanager/addFile', body);
  }

  // ---- SMS Templates (24) --------------------------------------------------
  /** POST sms/getSMSTemplates — smsTemplateTypeID left undefined ⇒ full list (old behaviour). */
  getSMSTemplates(
    providerServiceMapID: number,
    smsTemplateTypeID?: number,
  ): Observable<ApiResponse> {
    return this.common('sms/getSMSTemplates', { providerServiceMapID, smsTemplateTypeID });
  }

  /** POST sms/getFullSMSTemplate. */
  getFullSMSTemplate(
    providerServiceMapID: number,
    smsTemplateID: number,
  ): Observable<ApiResponse> {
    return this.common('sms/getFullSMSTemplate', { providerServiceMapID, smsTemplateID });
  }

  /** POST sms/getSMSTypes. */
  getSMSTypes(serviceID: number): Observable<ApiResponse> {
    return this.common('sms/getSMSTypes', { serviceID });
  }

  /** POST sms/getSMSParameters. */
  getSMSParameters(serviceID: number): Observable<ApiResponse> {
    return this.common('sms/getSMSParameters', { serviceID });
  }

  /** POST sms/saveSMSTemplate. */
  saveSMSTemplate(body: Record<string, unknown>): Observable<ApiResponse> {
    return this.common('sms/saveSMSTemplate', body);
  }

  /** POST sms/updateSMSTemplate — the whole template row with `deleted`/`modifiedBy` mutated. */
  updateSMSTemplate(body: Record<string, unknown>): Observable<ApiResponse> {
    return this.common('sms/updateSMSTemplate', body);
  }

  // ---- Call Auditing / Quality Audit (5) — read-only -----------------------
  /** POST adminAPI getServiceProviderid. */
  getServiceProviderID(providerServiceMapID: number): Observable<ApiResponse> {
    return this.admin('getServiceProviderid', { providerServiceMapID });
  }

  /** POST adminAPI m/role/serviceNew — the user's service lines. */
  getServiceLines(userID: number | string): Observable<ApiResponse> {
    return this.admin('m/role/serviceNew', { userID });
  }

  /** POST adminAPI m/role/search. */
  getRoles(
    serviceProviderID: number,
    serviceID: number,
    isNational: boolean,
  ): Observable<ApiResponse> {
    return this.admin('m/role/search', { serviceProviderID, serviceID, isNational });
  }

  /** POST adminAPI getAllAgentIds. */
  getAllAgentIds(providerServiceMapID: number): Observable<ApiResponse> {
    return this.admin('getAllAgentIds', { providerServiceMapID });
  }

  /** POST user/getAgentByRoleID — note the capital-R `RoleID` key (old app). */
  getAgentByRoleID(providerServiceMapID: number, RoleID: number): Observable<ApiResponse> {
    return this.common('user/getAgentByRoleID', { providerServiceMapID, RoleID });
  }

  /** POST call/getCallTypesV1. */
  getCallTypes(providerServiceMapID: number): Observable<ApiResponse> {
    return this.common('call/getCallTypesV1', { providerServiceMapID });
  }

  /** POST call/filterCallList — the audit search (Variant A/B body built by the caller). */
  filterCallList(body: Record<string, unknown>): Observable<ApiResponse> {
    return this.common('call/filterCallList', body);
  }

  /** POST ip1097 services/getCaseSheet — read-only case-sheet summary (response is an array). */
  getCaseSheet(benCallID: number): Observable<ApiResponse> {
    return this.ip1097('services/getCaseSheet', { benCallID, is1097: true });
  }
}
