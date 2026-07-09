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

import { ApiResponse } from '../models';
import { ConfigService } from './config.service';

/**
 * App/build info. Ports the old `loginService.getApiVersionDetails()` — a GET on the
 * Helpline1097 API `version` endpoint returning git build info
 * (`git.build.version`, `git.commit.id`). Used by the Help → Version dialog.
 */
@Injectable({ providedIn: 'root' })
export class AppInfoService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  getApiVersionDetails(): Observable<ApiResponse<Record<string, string>>> {
    return this.http.get<ApiResponse<Record<string, string>>>(
      `${this.config.helpline1097BaseURL}version`,
    );
  }
}
