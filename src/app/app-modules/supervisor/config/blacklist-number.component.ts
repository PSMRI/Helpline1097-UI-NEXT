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

import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';

import { RestrictInputDirective } from '@/app-modules/core/directives/restrict-input.directive';
import { MOBILE_NUMBER_BLOCK } from '@/app-modules/core/directives/input-patterns';
import { ConfigApiService } from './config-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** A blacklist row from call/getBlacklistNumbers. */
interface BlacklistRow {
  phoneBlockID: number;
  phoneNo: number;
  isBlocked?: boolean;
  noOfNuisanceCall?: number;
  blockStartDate?: number;
  blockEndDate?: number;
  [key: string]: unknown;
}

/** A nuisance-call recording row from call/nueisanceCallHistory workList. */
interface RecordingRow {
  benCallID?: number;
  callID?: number | string;
  agentID?: number | string;
  phoneNo?: number;
  callTime?: number;
  remarks?: string;
  beneficiaryModel?: {
    beneficiaryID?: number;
    firstName?: string;
    lastName?: string;
    actualAge?: number | string;
    ageUnits?: string;
  };
  [key: string]: unknown;
}

const ROWS_PER_PAGE = 5;

/**
 * Blacklist a Number (supervisor page 3). Lists blacklist entries, toggles block/unblock on
 * existing `phoneBlockID` rows, and drills into a number's nuisance-call recordings with inline
 * CTI audio playback. The old app had no "add a new number" form — block/unblock operate only
 * on rows the backend already returns. No `createdBy`/`modifiedBy` is sent (backend derives the
 * actor from the auth token).
 */
@Component({
  selector: 'app-blacklist-number',
  imports: [ReactiveFormsModule, DatePipe, ZardButtonComponent, ZardInputDirective, RestrictInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './blacklist-number.component.html',
})
export class BlacklistNumberComponent implements OnInit {
  protected readonly mobileNumberBlock = MOBILE_NUMBER_BLOCK;

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ConfigApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  /** Cache of resolved audio paths keyed `callID|agentID` (old app's recordingArray). */
  private readonly audioCache = new Map<string, string>();

  protected readonly rows = signal<BlacklistRow[]>([]);
  protected readonly searchByPhone = signal(false);
  protected readonly recordingRows = signal<RecordingRow[] | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly loading = signal(false);
  /** Index of the recording row whose inline <audio> is open, and its resolved URL. */
  protected readonly audioRowIndex = signal<number | null>(null);
  protected readonly audioUrl = signal<string | null>(null);

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.rows().length / ROWS_PER_PAGE)),
  );
  protected readonly pagedRows = computed(() => {
    const start = this.pageIndex() * ROWS_PER_PAGE;
    return this.rows().slice(start, start + ROWS_PER_PAGE);
  });

  protected readonly searchForm = this.fb.group({
    phoneNumber: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(10)],
    }),
  });

  ngOnInit(): void {
    this.loadList();
  }

  private loadList(phoneNo?: number): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.loading.set(true);
    this.api.getBlacklistNumbers(serviceId, phoneNo).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.rows.set(Array.isArray(res?.data) ? (res.data as BlacklistRow[]) : []);
        this.pageIndex.set(0);
      },
      error: (err: { errorMessage?: string }) => {
        this.loading.set(false);
        this.rows.set([]);
        this.notify.alert(err?.errorMessage ?? 'Failed to load blacklist', 'error');
      },
    });
  }

  protected toggleSearchByPhone(event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.searchByPhone.set(on);
    if (!on) {
      // Old app cleared the phone and reloaded the full list when search is switched off.
      this.searchForm.reset({ phoneNumber: '' });
      this.loadList();
    }
  }

  protected search(): void {
    if (this.searchForm.invalid) {
      return;
    }
    this.loadList(Number(this.searchForm.controls.phoneNumber.value));
  }

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }
  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  protected block(row: BlacklistRow): void {
    this.api.blockPhoneNumber(row.phoneBlockID).subscribe({
      next: () => {
        this.notify.alert('Number blocked successfully', 'success');
        this.afterToggle();
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to block number', 'error'),
    });
  }

  protected unblock(row: BlacklistRow): void {
    this.api.unblockPhoneNumber(row.phoneBlockID).subscribe({
      next: () => {
        this.notify.alert('Number unblocked successfully', 'success');
        this.afterToggle();
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to unblock number', 'error'),
    });
  }

  private afterToggle(): void {
    this.recordingRows.set(null);
    this.audioRowIndex.set(null);
    this.loadList(this.currentPhoneFilter());
  }

  private currentPhoneFilter(): number | undefined {
    return this.searchByPhone() && this.searchForm.valid
      ? Number(this.searchForm.controls.phoneNumber.value)
      : undefined;
  }

  protected showRecordings(row: BlacklistRow): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.audioRowIndex.set(null);
    this.api.nuisanceCallHistory(serviceId, row.phoneNo, row.noOfNuisanceCall ?? 0).subscribe({
      next: (res) => {
        const data = res?.data as { workList?: RecordingRow[] } | undefined;
        this.recordingRows.set(data?.workList ?? null);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load recordings', 'error'),
    });
  }

  protected playAudio(row: RecordingRow, index: number): void {
    const agentID = row.agentID;
    const callID = row.callID;
    if (agentID == null || callID == null) {
      return;
    }
    const key = `${callID}|${agentID}`;
    const cached = this.audioCache.get(key);
    if (cached !== undefined) {
      this.audioUrl.set(cached);
      this.audioRowIndex.set(index);
      return;
    }
    this.api.getFilePathCTI(agentID, callID).subscribe({
      next: (res) => {
        const url = (res?.data as { response?: string } | undefined)?.response ?? '';
        this.audioCache.set(key, url);
        this.audioUrl.set(url);
        this.audioRowIndex.set(index);
      },
      error: () => this.notify.alert('Failed to get the voice file path', 'error'),
    });
  }
}
