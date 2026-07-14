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
  BenFeedbackRequest,
  CoCategory,
  CoSubCategory,
  CounsellingMappingRequest,
  FeedbackListRequest,
  InformationMappingRequest,
  ReferralMappingRequest,
} from '../models';
import { ConfigService } from './config.service';

/**
 * CO-services API (information / counselling / referral / feedback tabs) — Phase 6 port of
 * the old `co_category_subcategory` / `co_referral` / `co_feedback` / feedbacktypes
 * services. Endpoints split across BOTH gateways exactly like the old app: category
 * masters + saves + histories + designations + feedback save live on the **1097** base
 * URL; sub-categories and the feedback masters/list live on the **common** base URL.
 *
 * Old-app naming trap, preserved in intent but renamed for honesty: the old "getDetails"
 * methods were SAVES (POSTs that persist the service-given mapping and return the saved
 * rows) — here they are `save*Mapping`.
 */
@Injectable({ providedIn: 'root' })
export class CoServicesApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** POST {1097}api/helpline1097/co/get/categoryByID — categories of a sub-service. */
  getCategories(subServiceID: number): Observable<ApiResponse<CoCategory[]>> {
    return this.http.post<ApiResponse<CoCategory[]>>(
      `${this.config.helpline1097BaseURL}api/helpline1097/co/get/categoryByID`,
      { subServiceID },
    );
  }

  /** POST service/subcategory — sub-categories of a category. */
  getSubCategories(categoryID: number | string): Observable<ApiResponse<CoSubCategory[]>> {
    return this.http.post<ApiResponse<CoSubCategory[]>>(
      `${this.config.commonBaseURL}service/subcategory`,
      { categoryID },
    );
  }

  /** POST {1097}iEMR/saveBenCalServiceCatSubcatMapping — information "Get Details" (a SAVE). */
  saveInformationMapping(
    request: InformationMappingRequest,
  ): Observable<ApiResponse<CoSubCategory[]>> {
    return this.http.post<ApiResponse<CoSubCategory[]>>(
      `${this.config.helpline1097BaseURL}iEMR/saveBenCalServiceCatSubcatMapping`,
      [request],
    );
  }

  /** POST {1097}iEMR/saveBenCalServiceCOCatSubcatMapping — counselling save (`co*ID` keys). */
  saveCounsellingMapping(
    request: CounsellingMappingRequest,
  ): Observable<ApiResponse<CoSubCategory[]>> {
    return this.http.post<ApiResponse<CoSubCategory[]>>(
      `${this.config.helpline1097BaseURL}iEMR/saveBenCalServiceCOCatSubcatMapping`,
      [request],
    );
  }

  /** POST {1097}iEMR/saveBenCalReferralMapping — referral save; returns matching institutions. */
  saveReferralMapping(request: ReferralMappingRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.helpline1097BaseURL}iEMR/saveBenCalReferralMapping`,
      [request],
    );
  }

  /** POST {1097}services/getInformationsHistory. */
  getInformationHistory(
    beneficiaryRegID: number | string,
    calledServiceID: number,
  ): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.helpline1097BaseURL}services/getInformationsHistory`,
      { beneficiaryRegID, calledServiceID },
    );
  }

  /** POST {1097}services/getCounsellingsHistory. */
  getCounsellingHistory(
    beneficiaryRegID: number | string,
    calledServiceID: number,
  ): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.helpline1097BaseURL}services/getCounsellingsHistory`,
      { beneficiaryRegID, calledServiceID },
    );
  }

  /** POST {1097}services/getReferralsHistory. */
  getReferralHistory(
    beneficiaryRegID: number | string,
    calledServiceID: number,
  ): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.helpline1097BaseURL}services/getReferralsHistory`,
      { beneficiaryRegID, calledServiceID },
    );
  }

  /** POST {1097}designation/get — designation master (old sent `{}`). */
  getDesignations(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.helpline1097BaseURL}designation/get`, {});
  }

  /** POST feedback/getFeedbackType. */
  getFeedbackTypes(providerServiceMapID: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}feedback/getFeedbackType`, {
      providerServiceMapID,
    });
  }

  /** POST feedback/getSeverity. */
  getFeedbackSeverities(providerServiceMapID: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}feedback/getSeverity`, {
      providerServiceMapID,
    });
  }

  /** POST {1097}co/saveBenFeedback — submit a beneficiary feedback/complaint. */
  saveBenFeedback(request: BenFeedbackRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.helpline1097BaseURL}co/saveBenFeedback`, [
      request,
    ]);
  }

  /** POST feedback/getFeedbacksList — by beneficiary or by id/phone search (one endpoint). */
  getFeedbacksList(request: FeedbackListRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.config.commonBaseURL}feedback/getFeedbacksList`,
      request,
    );
  }
}
