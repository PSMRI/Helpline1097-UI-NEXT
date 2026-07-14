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

import { ApiResponse, SendSmsRequest, SmsTemplate, SmsType } from '../models';
import { ConfigService } from './config.service';

/**
 * SMS API — Phase 6 port of the old `SmsTemplateService` slice used by the call flow
 * (registration SMS + referral SMS): types → templates → send, matched by name
 * ("Registration SMS" / "Referral SMS") in the consuming components, as in the old app.
 */
@Injectable({ providedIn: 'root' })
export class SmsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** POST sms/getSMSTypes. */
  getSmsTypes(serviceID: number): Observable<ApiResponse<SmsType[]>> {
    return this.http.post<ApiResponse<SmsType[]>>(`${this.config.commonBaseURL}sms/getSMSTypes`, {
      serviceID,
    });
  }

  /** POST sms/getSMSTemplates. */
  getSmsTemplates(
    providerServiceMapID: number,
    smsTemplateTypeID: number,
  ): Observable<ApiResponse<SmsTemplate[]>> {
    return this.http.post<ApiResponse<SmsTemplate[]>>(
      `${this.config.commonBaseURL}sms/getSMSTemplates`,
      { providerServiceMapID, smsTemplateTypeID },
    );
  }

  /** POST sms/sendSMS — array payload, one item per recipient number. */
  sendSms(requests: SendSmsRequest[]): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.config.commonBaseURL}sms/sendSMS`, requests);
  }
}
