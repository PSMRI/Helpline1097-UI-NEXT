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

import { Injectable, signal } from '@angular/core';

/**
 * Transient state shared across the multi-screen reset/onboarding flow:
 *  - `username`  carried from reset-password → set-password (old `dataService.uname`)
 *  - `transactionId` minted by validate/save and consumed by set-password
 *    (old `loginService.transactionId`)
 *
 * Kept in memory only — a page refresh clears it and the user restarts the flow,
 * exactly as in the old app (it never persisted these to storage).
 */
@Injectable({ providedIn: 'root' })
export class AuthFlowStore {
  private readonly _username = signal<string | null>(null);
  private readonly _transactionId = signal<string | null>(null);

  readonly username = this._username.asReadonly();
  readonly transactionId = this._transactionId.asReadonly();

  setUsername(value: string): void {
    this._username.set(value);
  }

  setTransactionId(value: string): void {
    this._transactionId.set(value);
  }

  reset(): void {
    this._username.set(null);
    this._transactionId.set(null);
  }
}
