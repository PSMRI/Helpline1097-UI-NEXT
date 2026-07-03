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
import {
  AuthenticateResponse,
  SaveSecurityQuestion,
  SecurityQuestion,
  SecurityQuestionAnswer,
  SecurityQuestionMaster,
} from '../models/auth.models';

/**
 * All auth/login HTTP calls — a faithful port of the old `loginService` (and the
 * security/password endpoints it shared). Every method returns the raw `ApiResponse`
 * envelope; the global response interceptor already handles 5002 (concurrent session →
 * AuthEventsService) / 5006 / 401. Endpoints all sit on the open common base
 * (old `getOpenCommonBaseUrl()`), which equals the common base in this app.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get base(): string {
    return this.config.openCommonBaseURL;
  }

  /** POST user/userAuthenticate — `password` must already be encrypted. */
  authenticateUser(
    userName: string,
    password: string,
    doLogout: boolean,
    captchaToken?: string,
  ): Observable<ApiResponse<AuthenticateResponse>> {
    const body: Record<string, unknown> = {
      userName,
      password,
      withCredentials: true,
      doLogout,
    };
    if (captchaToken !== undefined) {
      body['captchaToken'] = captchaToken;
    }
    return this.http.post<ApiResponse<AuthenticateResponse>>(`${this.base}user/userAuthenticate`, body);
  }

  /** POST user/logOutUserFromConcurrentSession — force-logout an existing session before re-login. */
  logOutFromConcurrentSession(userName: string): Observable<ApiResponse<{ response?: string }>> {
    return this.http.post<ApiResponse<{ response?: string }>>(
      `${this.base}user/logOutUserFromConcurrentSession`,
      { userName },
    );
  }

  /** POST user/getLoginResponse — validate an existing token on app start. */
  getLoginResponse(): Observable<ApiResponse<AuthenticateResponse>> {
    return this.http.post<ApiResponse<AuthenticateResponse>>(`${this.base}user/getLoginResponse`, {});
  }

  /** POST user/forgetPassword — fetch the user's security questions (reset flow). */
  getSecurityQuestions(
    userName: string,
  ): Observable<ApiResponse<{ SecurityQuesAns?: SecurityQuestion[] }>> {
    return this.http.post<ApiResponse<{ SecurityQuesAns?: SecurityQuestion[] }>>(
      `${this.base}user/forgetPassword`,
      { userName },
    );
  }

  /** POST user/validateSecurityQuestionAndAnswer — returns a transactionId on success. */
  validateSecurityQuestionAndAnswer(
    securityQuesAns: SecurityQuestionAnswer[],
    userName: string,
  ): Observable<ApiResponse<{ transactionId?: string }>> {
    return this.http.post<ApiResponse<{ transactionId?: string }>>(
      `${this.base}user/validateSecurityQuestionAndAnswer`,
      { SecurityQuesAns: securityQuesAns, userName },
    );
  }

  /** GET user/getsecurityquetions — the master list of security questions (new-user setup). */
  getSecurityQuestionList(): Observable<ApiResponse<SecurityQuestionMaster[]>> {
    return this.http.get<ApiResponse<SecurityQuestionMaster[]>>(`${this.base}user/getsecurityquetions`);
  }

  /** POST user/saveUserSecurityQuesAns — persist the chosen Q&A; returns a transactionId. */
  saveUserSecurityQuesAns(
    records: SaveSecurityQuestion[],
  ): Observable<ApiResponse<{ transactionId?: string }>> {
    return this.http.post<ApiResponse<{ transactionId?: string }>>(
      `${this.base}user/saveUserSecurityQuesAns`,
      records,
    );
  }

  /** POST user/setForgetPassword — set the new password using a validated transactionId. */
  setForgetPassword(
    userName: string,
    password: string,
    transactionId: string,
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}user/setForgetPassword`, {
      userName,
      password,
      transactionId,
    });
  }
}
