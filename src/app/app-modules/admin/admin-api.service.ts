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
import { map, Observable } from 'rxjs';

import { ApiResponse } from '@/app-modules/core/models';
import { ConfigService } from '@/app-modules/core/services/config.service';

/**
 * Super-admin console endpoints (old `SPService`, `UserService`, `ServicemasterService`).
 *
 * Two faithful details carried over from those services:
 *  - the list calls send an ignored body (the old code accidentally posted a serialised
 *    `RequestOptions` object; the server ignores it either way);
 *  - responses are unwrapped as `data ?? whole body` (old `extractData`), so a payload that
 *    arrives without a `data` envelope is handed to the caller as-is.
 *
 * Bases: Service Provider on `adminAPI`, Admin User on `commonAPI` (not admin — the old
 * `UserService` really did use the common base), Service Master on `adminAPI` (see below).
 */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** Old `extractData`: `response.json().data ? data : whole body`. */
  private unwrap<T>(): (res: ApiResponse<T>) => T {
    return (res) => ((res?.data ?? res) as T);
  }

  private admin<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(`${this.config.adminBaseURL}${path}`, body).pipe(map(this.unwrap<T>()));
  }

  private common<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(`${this.config.commonBaseURL}${path}`, body).pipe(map(this.unwrap<T>()));
  }

  // ---- Tab 1: Service Provider (adminAPI) ----------------------------------
  /** POST adminAPI `getprovider` — body ignored by the server (old quirk). */
  getProviders(): Observable<ServiceProviderRow[]> {
    return this.admin<ServiceProviderRow[]>('getprovider', {});
  }

  /** POST adminAPI `saveprovider` — the whole 39-key form value, in declaration order. */
  saveProvider(body: ServiceProviderRequest): Observable<unknown> {
    return this.admin<unknown>('saveprovider', body);
  }

  /** POST adminAPI `Delete` (capital D) — `serviceProviderId` sent as a STRING (old quirk). */
  deleteProvider(serviceProviderId: string): Observable<ServiceProviderRow[]> {
    return this.admin<ServiceProviderRow[]>('Delete', { serviceProviderId });
  }

  // NOTE: the old service also declared `UpdateServiceProvider`, but nothing ever called it —
  // its "update" path posted to `Delete`, and the Edit button re-saved as a new record. Not
  // ported: there is no old behaviour to be faithful to.

  // ---- Tab 2: Admin User (commonAPI — deliberately not the admin base) -----
  /** POST commonAPI `user/iEMR/User/getData`. */
  getUsers(): Observable<AdminUserRow[]> {
    return this.common<AdminUserRow[]>('user/iEMR/User/getData', {});
  }

  /** POST commonAPI `user/iEMR/User/saveUser`. */
  saveUser(body: AdminUserRequest): Observable<unknown> {
    return this.common<unknown>('user/iEMR/User/saveUser', body);
  }

  // ---- Tab 3: Service Master ------------------------------------------------
  // DECLARED DEVIATION: the old `ServicemasterService` hardcoded
  // `http://localhost:8080/iEMR/ServiceMaster/...` and never injected ConfigService, so both of
  // its calls fail in any deployed environment (localhost = the client machine) and the screen
  // is dead in the old app. Approved decision: resolve them against the admin base instead, so
  // the screen is at least capable of working. The paths are otherwise verbatim.
  /** POST adminAPI `iEMR/ServiceMaster/getServiceData`. */
  getServiceMaster(): Observable<ServiceMasterRow[]> {
    return this.admin<ServiceMasterRow[]>('iEMR/ServiceMaster/getServiceData', {});
  }

  /** POST adminAPI `iEMR/ServiceMaster/saveService`. */
  saveServiceMaster(body: ServiceMasterRequest): Observable<unknown> {
    return this.admin<unknown>('iEMR/ServiceMaster/saveService', body);
  }
}

/**
 * `getprovider` row. Response keys are PascalCase while the save payload is camelCase — a real
 * asymmetry in the backend contract, preserved verbatim on both sides.
 */
export interface ServiceProviderRow {
  ServiceProviderId?: number | string;
  ServiceProviderName?: string;
  PrimaryContactName?: string;
  PrimaryContactNo?: string;
  /** Old `updateSP` read these two in camelCase (see the component's prefill note). */
  emailID?: string;
  address?: string;
  [key: string]: unknown;
}

/** `saveprovider` body — 39 keys, and the order below IS the old form's declaration order. */
export interface ServiceProviderRequest {
  logoFilePath: string | null;
  primaryContactName: string | null;
  primaryContactNo: string | null;
  emailID: string | null;
  address: string | null;
  validity: string | null;
  roleName: string | null;
  roleDescription: string | null;
  services: string | null;
  minEducationalQualification: string | null;
  specialization: string | null;
  role: string | null;
  zoneDistrict: string | null;
  zoneName: string | null;
  stateParkingPlace: string | null;
  zoneParkingPlace: string | null;
  districtParkingPlace: string | null;
  parkingPlace: string | null;
  stateServicePoint: string | null;
  parkingPlaceServicePoint: string | null;
  servicePoint: string | null;
  loginID: string | null;
  pwd: string | null;
  firstName: string | null;
  lastName: string | null;
  education: string | null;
  employeeID: string | null;
  aadharNo: string | null;
  gender: string | null;
  panNo: string | null;
  father: string | null;
  mother: string | null;
  emergencyContactPerson: string | null;
  emergencyContactNo: string | null;
  serviceProviderName: string;
  createdBy: string;
  createdDate: string;
  stateId: string;
  joiningDate: string;
}

/** `user/iEMR/User/getData` row — the old table read mixed casing (see the component). */
export interface AdminUserRow {
  FirstName?: string;
  lastName?: string;
  UserName?: string;
  [key: string]: unknown;
}

/** `user/iEMR/User/saveUser` body — 11 keys in the old declaration order. */
export interface AdminUserRequest {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  titleID: string;
  userName: string | null;
  password: string | null;
  statusID: string;
  createdBy: string;
  createdDate: string;
  modifiedBy: string;
  lastModDate: string;
}

/** `ServiceMaster/getServiceData` row (PascalCase, as the old table read it). */
export interface ServiceMasterRow {
  ServiceName?: string;
  ServiceDesc?: string;
  [key: string]: unknown;
}

/** `ServiceMaster/saveService` body — 6 keys in the old declaration order. */
export interface ServiceMasterRequest {
  serviceName: string | null;
  serviceDesc: string | null;
  createdBy: string;
  createdDate: string;
  modifiedBy: string;
  lastModDate: string;
}
