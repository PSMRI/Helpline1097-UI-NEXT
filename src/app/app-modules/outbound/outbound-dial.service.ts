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

import { CtiService } from '@/app-modules/core/services/cti.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStorageService } from '@/app-modules/core/services/session-storage.service';
import { CallStore } from '@/app-modules/core/state/call.store';

/**
 * The shared CZentrix worklist-dial handshake (old `manualDialaNumber` success handling,
 * identical across the three worklist tabs): ring the number; on success remember the
 * caller (memory-only, like the old `callerNumber` — the Accept event persists CLI),
 * set `isOnCall`, and stamp the variant flag when the flow has one
 * (`isEverwellCall` / `isGrievanceCall`).
 */
@Injectable({ providedIn: 'root' })
export class OutboundDialService {
  private readonly cti = inject(CtiService);
  private readonly notify = inject(NotificationService);
  private readonly storage = inject(SessionStorageService);
  private readonly callStore = inject(CallStore);

  dial(phone: string, flagKey?: string): void {
    this.cti.dialBeneficiary(phone).subscribe({
      next: (res) => {
        if (((res as { status?: string })?.status ?? '').toLowerCase() === 'fail') {
          this.notify.alert('Something went wrong in calling', 'error');
          return;
        }
        this.callStore.cli.set(phone);
        this.callStore.setOnCall(true);
        if (flagKey) {
          this.storage.setItem(flagKey, 'yes');
        }
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Something went wrong in calling', 'error'),
    });
  }
}
