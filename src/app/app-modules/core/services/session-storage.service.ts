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
import * as CryptoJS from 'crypto-js';
import { environment } from '@env/environment';

/**
 * Storage key registry. The old app uses a MIXED scheme that MUST be preserved:
 *  - PLAIN keys are read/written via raw sessionStorage (the auth interceptor reads
 *    `authToken`/`apiman_key` in plain text).
 *  - ENCRYPTED keys are AES-encrypted (value) via this service (the guards read
 *    `isOnCall` decrypted).
 * Each key must always be accessed with the scheme its readers expect.
 */
export const PLAIN_KEYS = {
  authToken: 'authToken',
  apimanKey: 'apiman_key',
  userId: 'userID',
} as const;

export const ENCRYPTED_KEYS = {
  isOnCall: 'isOnCall',
  sessionId: 'session_id',
  cli: 'CLI',
  callCategory: 'callCategory',
  currentCampaign: 'current_campaign',
  isEverwellCall: 'isEverwellCall',
  isGrievanceCall: 'isGrievanceCall',
  callTransferred: 'callTransferred',
  privilegeFlag: 'privilege_flag',
  authen: 'authen',
  setLanguage: 'setLanguage',
} as const;

/**
 * Session storage wrapper. The encrypted path is a verbatim port of the old
 * `sessionStorageService` (CryptoJS AES, value-encrypted with `environment.encKey`)
 * so the on-disk format stays byte-compatible with MMU/104.
 */
@Injectable({ providedIn: 'root' })
export class SessionStorageService {
  // Threat model: this AES layer is light obfuscation, not a security boundary. `encKey` is
  // injected at build time and ships in the client bundle, so it is not secret from a
  // determined client; dev/test use a blank key (effectively no encryption). Do not rely on
  // this alone to protect truly sensitive data — it preserves the old app's storage contract.
  private readonly secretKey = environment.encKey;

  // ---- Encrypted (AES) — for ENCRYPTED_KEYS ----
  setItem(key: string, value: string): void {
    const ciphertext = CryptoJS.AES.encrypt(value, this.secretKey).toString();
    sessionStorage.setItem(key, ciphertext);
  }

  getItem(key: string): string | null {
    const text = sessionStorage.getItem(key);
    if (text) {
      const bytes = CryptoJS.AES.decrypt(text, this.secretKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    }
    return null;
  }

  // ---- Plain — for PLAIN_KEYS (authToken, apiman_key, userID) ----
  setPlain(key: string, value: string): void {
    sessionStorage.setItem(key, value);
  }

  getPlain(key: string): string | null {
    return sessionStorage.getItem(key);
  }

  // ---- Common ----
  removeItem(key: string): void {
    sessionStorage.removeItem(key);
  }

  clear(): void {
    sessionStorage.clear();
  }
}
