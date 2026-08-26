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

/** A supervisor notification/type row (`notification/getNotificationType`). */
export interface NotificationType {
  notificationTypeID: number;
  notificationType: string;
  [key: string]: unknown;
}

/** A role row (`user/getRolesByProviderID`); `featureName` present ⇒ real role. */
export interface ProviderRole {
  roleID: number;
  roleName: string;
  featureName?: unknown[];
  [key: string]: unknown;
}

/** An office/working-location row — both office endpoints key on `pSAddMapID` (capital S). */
export interface OfficeRow {
  pSAddMapID: number;
  locationName: string;
  [key: string]: unknown;
}

/** A designation row (`m/getDesignation`). */
export interface Designation {
  designationID: number;
  designationName: string;
  [key: string]: unknown;
}

/**
 * Shift a Date so its UTC wall-clock equals its local wall-clock, then serialise — the exact
 * `new Date(d.valueOf() - d.getTimezoneOffset()*60000)` the old NotificationService applied
 * before posting `validStartDate`/`validFrom` boundaries. Returns an ISO string.
 */
export function tzShift(date: Date): string {
  return new Date(date.valueOf() - date.getTimezoneOffset() * 60000).toISOString();
}

/**
 * Supervisor Communication endpoints (old NotificationService): alerts/notifications,
 * location messages, training resources (KM) and emergency contacts. Bodies are
 * byte-faithful to the old app — createNotification/createEmergencyContacts POST ARRAYS
 * (one element per audience), their update counterparts POST a single OBJECT.
 */
@Injectable({ providedIn: 'root' })
export class CommunicationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private common(path: string, body: unknown): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}${path}`, body);
  }

  private admin(path: string, body: unknown): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.adminBaseURL}${path}`, body);
  }

  /** POST adminAPI getServiceProviderid — old init call (result mostly unused). */
  getServiceProviderID(providerServiceMapID: number): Observable<ApiResponse> {
    return this.admin('getServiceProviderid', { providerServiceMapID });
  }

  /** POST notification/getNotificationType. */
  getNotificationTypes(providerServiceMapID: number): Observable<ApiResponse<NotificationType[]>> {
    return this.http.post<ApiResponse<NotificationType[]>>(
      `${this.config.commonBaseURL}notification/getNotificationType`,
      { providerServiceMapID },
    );
  }

  /** POST user/getRolesByProviderID. */
  getRoles(providerServiceMapID: number): Observable<ApiResponse<ProviderRole[]>> {
    return this.http.post<ApiResponse<ProviderRole[]>>(
      `${this.config.commonBaseURL}user/getRolesByProviderID`,
      { providerServiceMapID },
    );
  }

  /** POST user/getLocationsByProviderID — alerts offices (roleID omitted for "All"). */
  getLocationsByProviderID(
    providerServiceMapID: number,
    roleID?: number,
  ): Observable<ApiResponse<OfficeRow[]>> {
    const body: Record<string, unknown> = { providerServiceMapID };
    if (roleID !== undefined) {
      body['roleID'] = roleID;
    }
    return this.http.post<ApiResponse<OfficeRow[]>>(
      `${this.config.commonBaseURL}user/getLocationsByProviderID`,
      body,
    );
  }

  /** POST adminAPI m/location/getAlllocationNew — location-message offices. */
  getAllLocationNew(providerServiceMapID: number): Observable<ApiResponse<OfficeRow[]>> {
    return this.http.post<ApiResponse<OfficeRow[]>>(
      `${this.config.adminBaseURL}m/location/getAlllocationNew`,
      { providerServiceMapID },
    );
  }

  /** POST adminAPI m/getDesignation — emergency-contact designations (empty body). */
  getDesignations(): Observable<ApiResponse<Designation[]>> {
    return this.http.post<ApiResponse<Designation[]>>(
      `${this.config.adminBaseURL}m/getDesignation`,
      {},
    );
  }

  /** POST notification/getSupervisorNotification — list for a screen's search window. */
  getSupervisorNotification(body: Record<string, unknown>): Observable<ApiResponse> {
    return this.common('notification/getSupervisorNotification', body);
  }

  /** POST notification/createNotification — ARRAY body (one element per audience). */
  createNotification(body: unknown[]): Observable<ApiResponse> {
    return this.common('notification/createNotification', body);
  }

  /** POST notification/updateNotification — single OBJECT body. */
  updateNotification(body: Record<string, unknown>): Observable<ApiResponse> {
    return this.common('notification/updateNotification', body);
  }

  /** POST notification/getSupervisorEmergencyContacts. */
  getSupervisorEmergencyContacts(
    providerServiceMapID: number,
    notificationTypeID: number,
  ): Observable<ApiResponse> {
    return this.common('notification/getSupervisorEmergencyContacts', {
      providerServiceMapID,
      notificationTypeID,
    });
  }

  /** POST notification/createEmergencyContacts — ARRAY body (the pending buffer). */
  createEmergencyContacts(body: unknown[]): Observable<ApiResponse> {
    return this.common('notification/createEmergencyContacts', body);
  }

  /** POST notification/updateEmergencyContacts — single OBJECT (edit / activate-deactivate). */
  updateEmergencyContacts(body: Record<string, unknown>): Observable<ApiResponse> {
    return this.common('notification/updateEmergencyContacts', body);
  }
}
