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
  DistrictRow,
  InstituteDirectory,
  InstituteSubDirectory,
  TalukRow,
  VillageRow,
} from '../models';
import { ConfigService } from './config.service';

/**
 * Location + directory master-data API — Phase 6 port of the old `location.service`.
 * States are NOT fetched here: the old registration screens took them from the
 * `getRegistrationDataV1` bundle (`location/states/{countryId}` existed but was unused).
 */
@Injectable({ providedIn: 'root' })
export class LocationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** GET location/districts/{stateId}. */
  getDistricts(stateId: number | string): Observable<ApiResponse<DistrictRow[]>> {
    return this.http.get<ApiResponse<DistrictRow[]>>(
      `${this.config.commonBaseURL}location/districts/${stateId}`,
    );
  }

  /** GET location/taluks/{districtId}. */
  getTaluks(districtId: number | string): Observable<ApiResponse<TalukRow[]>> {
    return this.http.get<ApiResponse<TalukRow[]>>(
      `${this.config.commonBaseURL}location/taluks/${districtId}`,
    );
  }

  /** GET location/village/{blockId} — the village dropdown (old `getBranches`). */
  getVillages(blockId: number | string): Observable<ApiResponse<VillageRow[]>> {
    return this.http.get<ApiResponse<VillageRow[]>>(
      `${this.config.commonBaseURL}location/village/${blockId}`,
    );
  }

  /** POST directory/getDirectoryV1 — referral directories for the service. */
  getDirectories(providerServiceMapID: number): Observable<ApiResponse<{ directory?: InstituteDirectory[] }>> {
    return this.http.post<ApiResponse<{ directory?: InstituteDirectory[] }>>(
      `${this.config.commonBaseURL}directory/getDirectoryV1`,
      { providerServiceMapID },
    );
  }

  /** POST directory/getSubDirectory — sub-directories of a directory. */
  getSubDirectories(
    instituteDirectoryID: number | string,
  ): Observable<ApiResponse<{ subDirectory?: InstituteSubDirectory[] }>> {
    return this.http.post<ApiResponse<{ subDirectory?: InstituteSubDirectory[] }>>(
      `${this.config.commonBaseURL}directory/getSubDirectory`,
      { instituteDirectoryID },
    );
  }

  /** POST institute/getInstituteTypes — institute-type master (old sent `{}`). */
  getInstituteTypes(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}institute/getInstituteTypes`, {});
  }
}
