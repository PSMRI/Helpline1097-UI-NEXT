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

import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { NotificationService } from '../services/notification.service';
import { ENCRYPTED_KEYS, SessionStorageService } from '../services/session-storage.service';

/**
 * Faithful port of the old class-based AuthGuard: allow only when logged in AND not mid-call
 * (blocks back-navigation during an active call). Returns `false` (blocks, no redirect) when
 * not logged in — exactly as the old guard did. Reads the persisted source of truth directly
 * (plain `authToken`, encrypted `isOnCall`).
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const storage = inject(SessionStorageService);
  const notify = inject(NotificationService);

  if (auth.isLoggedIn()) {
    if (storage.getItem(ENCRYPTED_KEYS.isOnCall) === 'yes') {
      notify.alert('Not allowed to go back. Please complete the current call.', 'warning');
      return false;
    }
    return true;
  }
  return false;
};

/**
 * Faithful port of the old AuthGuard2: the innerpage/call screen is reachable only during an
 * active call.
 */
export const onCallGuard: CanActivateFn = () => {
  const storage = inject(SessionStorageService);
  const notify = inject(NotificationService);

  if (storage.getItem(ENCRYPTED_KEYS.isOnCall) === 'yes') {
    return true;
  }
  notify.alert('Please wait for a call to arrive, or logout.', 'info');
  return false;
};
