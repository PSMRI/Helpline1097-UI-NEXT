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

export interface FeedbackType {
  feedbackTypeID: number;
  feedbackTypeName?: string;
}
export interface FeedbackStatus {
  feedbackStatusID: number;
  feedbackStatus?: string;
}
export interface EmailStatus {
  emailStatusID: number;
  emailStatus?: string;
}

/**
 * Feedback Tracking endpoints (old `<supervisor-grievance>` page 1). All on the commonAPI base.
 * Bodies are byte-faithful — note `getFeedbacksList` keys the id as `serviceID` while
 * `getFeedbackType` keys the SAME value as `providerServiceMapID`, and `SendEmail` capitalises
 * `FeedbackID`.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private post(path: string, body: unknown): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}${path}`, body);
  }

  /** POST feedback/getFeedbackType — the value is the current service id, keyed as providerServiceMapID. */
  getFeedbackTypes(serviceID: number): Observable<ApiResponse<FeedbackType[]>> {
    return this.http.post<ApiResponse<FeedbackType[]>>(
      `${this.config.commonBaseURL}feedback/getFeedbackType`,
      { providerServiceMapID: serviceID },
    );
  }

  /** POST feedback/getFeedbackStatus — empty body. */
  getFeedbackStatuses(): Observable<ApiResponse<FeedbackStatus[]>> {
    return this.http.post<ApiResponse<FeedbackStatus[]>>(
      `${this.config.commonBaseURL}feedback/getFeedbackStatus`,
      {},
    );
  }

  /** POST feedback/getEmailStatus — empty body. */
  getEmailStatuses(): Observable<ApiResponse<EmailStatus[]>> {
    return this.http.post<ApiResponse<EmailStatus[]>>(
      `${this.config.commonBaseURL}feedback/getEmailStatus`,
      {},
    );
  }

  /** POST feedback/getFeedbacksList — the search body (caller omits empty optional keys). */
  getFeedbacksList(body: Record<string, unknown>): Observable<ApiResponse> {
    return this.post('feedback/getFeedbacksList', body);
  }

  /** POST feedback/requestFeedback — the edit save (then the email modal opens). */
  requestFeedback(body: Record<string, unknown>): Observable<ApiResponse> {
    return this.post('feedback/requestFeedback', body);
  }

  /** POST feedback/updateResponse — the update save (with optional nested kmFileManager). */
  updateResponse(body: Record<string, unknown>): Observable<ApiResponse> {
    return this.post('feedback/updateResponse', body);
  }

  /** POST emailController/getAuthorityEmailID — auto-recipient emails for a district. */
  getAuthorityEmails(districtID: number): Observable<ApiResponse> {
    return this.post('emailController/getAuthorityEmailID', { districtID });
  }

  /** POST emailController/SendEmail — note the capitalised `FeedbackID` key. */
  sendEmail(feedbackID: number, emailID: string): Observable<ApiResponse> {
    return this.post('emailController/SendEmail', { FeedbackID: feedbackID, emailID, is1097: true });
  }
}
