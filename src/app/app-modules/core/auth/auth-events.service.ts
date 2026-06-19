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

import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Cross-component auth events. Replaces the `logoutUserFromPreviousSession` BehaviorSubject
 * that used to live inside the old InterceptedHttp. The response interceptor fires
 * `requestLogoutFromOtherDevice()` after the user confirms the 5002 "already logged in"
 * dialog; the login flow (Phase 3) subscribes to complete the logout-from-other-device.
 */
@Injectable({ providedIn: 'root' })
export class AuthEventsService {
  private readonly logoutFromOtherDevice = new Subject<void>();
  readonly logoutFromOtherDevice$: Observable<void> = this.logoutFromOtherDevice.asObservable();

  requestLogoutFromOtherDevice(): void {
    this.logoutFromOtherDevice.next();
  }
}
