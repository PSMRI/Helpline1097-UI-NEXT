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

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../models';
import { ConfigService } from './config.service';

/**
 * API-driven i18n. Replaces the old interceptor-instantiates-SetLanguageComponent hack with
 * a plain service that fetches the language set from `beneficiary/getLanguageList`.
 * (How components consume the language object is migrated per-screen in later phases.)
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  getLanguageList(): Observable<unknown[]> {
    return this.http
      .get<ApiResponse<unknown[]>>(`${this.config.openCommonBaseURL}beneficiary/getLanguageList`)
      .pipe(map((response) => response.data));
  }
}
