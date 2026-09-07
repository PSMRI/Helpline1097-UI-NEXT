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

import { ApiResponse, BeneficiaryRecord, RegistrationData } from '../models';
import { ConfigService } from './config.service';

/**
 * Beneficiary-domain API — Phase 6 port of the old `register-service` +
 * `userbeneficiarydata.service` + `update-service`. Endpoint URLs and payloads are
 * byte-faithful (incl. the forced `is1097: true` the old services injected).
 *
 * Note: the old register-service had a SECOND, string-built `searchBenficiary` variant
 * (keyed `cityID`) that no live component used — only the object-built variant below
 * (keyed `i_bendemographics.stateID/districtID/blockID`) is ported.
 */
@Injectable({ providedIn: 'root' })
export class BeneficiaryApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** POST beneficiary/create — register a new beneficiary (`is1097` forced like the old app). */
  createBeneficiary(beneficiary: BeneficiaryRecord): Observable<ApiResponse<BeneficiaryRecord>> {
    return this.http.post<ApiResponse<BeneficiaryRecord>>(
      `${this.config.commonBaseURL}beneficiary/create`,
      { ...beneficiary, is1097: true },
    );
  }

  /** POST beneficiary/searchUserByID — lookup by the display beneficiary id. */
  searchByBeneficiaryId(beneficiaryID: string | number): Observable<ApiResponse<BeneficiaryRecord[]>> {
    return this.http.post<ApiResponse<BeneficiaryRecord[]>>(
      `${this.config.commonBaseURL}beneficiary/searchUserByID`,
      { beneficiaryID, is1097: true },
    );
  }

  /** POST beneficiary/searchUserByID — lookup by the internal registration id. */
  searchByBeneficiaryRegId(
    beneficiaryRegID: string | number,
  ): Observable<ApiResponse<BeneficiaryRecord[]>> {
    return this.http.post<ApiResponse<BeneficiaryRecord[]>>(
      `${this.config.commonBaseURL}beneficiary/searchUserByID`,
      { beneficiaryRegID, is1097: true },
    );
  }

  /** POST beneficiary/searchUserByPhone — the CLI auto-search (old fixed paging kept). */
  searchByPhone(phoneNo: string): Observable<ApiResponse<BeneficiaryRecord[]>> {
    return this.http.post<ApiResponse<BeneficiaryRecord[]>>(
      `${this.config.commonBaseURL}beneficiary/searchUserByPhone`,
      { phoneNo, pageNo: 1, rowsPerPage: 1000, is1097: true },
    );
  }

  /** POST beneficiary/searchBeneficiary — the advanced-search form. */
  advancedSearch(criteria: {
    firstName?: string;
    lastName?: string | null;
    fatherName?: string;
    genderID?: number | string | null;
    beneficiaryID?: string | number | null;
    stateID?: number | string | null;
    districtID?: number | string | null;
    blockID?: number | string | null;
  }): Observable<ApiResponse<BeneficiaryRecord[]>> {
    return this.http.post<ApiResponse<BeneficiaryRecord[]>>(
      `${this.config.commonBaseURL}beneficiary/searchBeneficiary`,
      {
        firstName: criteria.firstName,
        lastName: criteria.lastName,
        fatherName: criteria.fatherName,
        genderID: criteria.genderID,
        beneficiaryID: criteria.beneficiaryID,
        i_bendemographics: {
          stateID: criteria.stateID,
          districtID: criteria.districtID,
          blockID: criteria.blockID,
        },
        is1097: true,
      },
    );
  }

  /** POST beneficiary/getRegistrationDataV1 — the registration master-data bundle. */
  getRegistrationData(providerServiceMapID: number): Observable<ApiResponse<RegistrationData>> {
    return this.http.post<ApiResponse<RegistrationData>>(
      `${this.config.commonBaseURL}beneficiary/getRegistrationDataV1`,
      { providerServiceMapID },
    );
  }

  /** POST beneficiary/update — whole-object update (change flags included by the caller). */
  updateBeneficiary(beneficiary: BeneficiaryRecord): Observable<ApiResponse<BeneficiaryRecord>> {
    return this.http.post<ApiResponse<BeneficiaryRecord>>(
      `${this.config.commonBaseURL}beneficiary/update`,
      beneficiary,
    );
  }

  // Old `getRelationships` (GET get/beneficiaryRelationship) is deliberately NOT ported:
  // it had zero callers in the old app (the relationship dropdown reads the
  // getRegistrationDataV1 bundle) and the endpoint 500s on UAT — dead code.
}
