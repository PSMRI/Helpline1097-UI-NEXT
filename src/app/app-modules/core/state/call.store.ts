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

import { inject, Injectable, signal } from '@angular/core';
import { ENCRYPTED_KEYS, SessionStorageService } from '../services/session-storage.service';

/**
 * Active-call state (signals). Replaces the call slice of the old `dataService`.
 * The persisted keys are AES-encrypted (the guards read `isOnCall` decrypted), so the
 * setters write through `SessionStorageService` with the encrypted scheme and hydrate
 * from it on construction.
 */
@Injectable({ providedIn: 'root' })
export class CallStore {
  private readonly storage = inject(SessionStorageService);

  readonly isOnCall = signal<boolean>(this.storage.getItem(ENCRYPTED_KEYS.isOnCall) === 'yes');
  readonly callId = signal<string | null>(null);
  readonly cli = signal<string | null>(this.storage.getItem(ENCRYPTED_KEYS.cli));
  readonly sessionId = signal<string | null>(this.storage.getItem(ENCRYPTED_KEYS.sessionId));
  readonly callCategory = signal<string | null>(this.storage.getItem(ENCRYPTED_KEYS.callCategory));
  readonly currentCampaign = signal<string | null>(
    this.storage.getItem(ENCRYPTED_KEYS.currentCampaign),
  );
  readonly isOutbound = signal<boolean>(false);
  readonly beneficiary = signal<Record<string, unknown>>({});

  setOnCall(value: boolean): void {
    this.isOnCall.set(value);
    this.storage.setItem(ENCRYPTED_KEYS.isOnCall, value ? 'yes' : 'no');
  }

  setSessionId(value: string): void {
    this.sessionId.set(value);
    this.storage.setItem(ENCRYPTED_KEYS.sessionId, value);
  }

  setCli(value: string): void {
    this.cli.set(value);
    this.storage.setItem(ENCRYPTED_KEYS.cli, value);
  }

  setCallCategory(value: string): void {
    this.callCategory.set(value);
    this.storage.setItem(ENCRYPTED_KEYS.callCategory, value);
  }

  reset(): void {
    this.isOnCall.set(false);
    this.callId.set(null);
    this.cli.set(null);
    this.sessionId.set(null);
    this.callCategory.set(null);
    this.currentCampaign.set(null);
    this.isOutbound.set(false);
    this.beneficiary.set({});
  }
}
