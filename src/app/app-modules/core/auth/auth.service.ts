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
import { PLAIN_KEYS, SessionStorageService } from '../services/session-storage.service';

/**
 * Auth token accessors. The old `auth.service` read/removed the token via PLAIN
 * sessionStorage — preserved here. The old `isAuthenticated()` was dead code that always
 * returned true; the guards do the real check, so we expose `isLoggedIn()` = token presence
 * (no client-side JWT-expiry validation — the backend signals expiry via 401/5002).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storage = inject(SessionStorageService);

  getToken(): string | null {
    return this.storage.getPlain(PLAIN_KEYS.authToken);
  }

  getApiKey(): string | null {
    return this.storage.getPlain(PLAIN_KEYS.apimanKey);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  removeToken(): void {
    this.storage.removeItem(PLAIN_KEYS.apimanKey);
    this.storage.removeItem(PLAIN_KEYS.authToken);
  }
}
