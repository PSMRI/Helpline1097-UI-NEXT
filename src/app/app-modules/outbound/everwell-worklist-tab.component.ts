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

import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePhoneOutgoing } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';

import { OutboundDialService } from './outbound-dial.service';
import { WorklistTable } from './worklist-table';
import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { OutboundApiService } from '@/app-modules/core/services/outbound-api.service';
import { ENCRYPTED_KEYS } from '@/app-modules/core/services/session-storage.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { LanguageStore } from '@/app-modules/core/state/language.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** PascalCase fields are the backend's names, kept verbatim. */
interface EverwellRow {
  eapiId?: number | string;
  beneficiaryID?: number | string;
  beneficiaryRegId?: number | string;
  FirstName?: string;
  LastName?: string;
  State?: string;
  District?: string;
  comments?: unknown;
  lastCall?: number | string;
  callCounter?: number;
  PrimaryNumber?: string;
  [key: string]: unknown;
}

/** Everwell outbound worklist tab (old `everwell-outbound-worklist`) — dial hands off via
 * `outboundEverwellData` + `isEverwellCall`; the in-call adherence slide is Phase 8. Table
 * reproduces the old md2DataTable: 4/page, sortable columns, serial number. */
@Component({
  selector: 'app-everwell-worklist-tab',
  imports: [NgIcon, ReactiveFormsModule, TranslatePipe, ZardButtonComponent, ZardInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucidePhoneOutgoing })],
  template: `
    <div class="flex flex-col gap-3 py-3">
      <div class="flex items-center justify-between gap-3">
        @if (rows().length) {
          <input
            z-input
            type="text"
            class="w-64"
            [placeholder]="'inTableSearch' | t"
            [formControl]="search"
            (input)="filter()"
          />
        } @else {
          <span></span>
        }
        <button z-button zType="outline" type="button" (click)="backToDashboard()">
          {{ 'backToDashboard' | t }}
        </button>
      </div>
      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-3 py-2">{{ 'sno' | t }}</th>
              <th class="cursor-pointer px-3 py-2" (click)="table.toggleSort('id')">
                {{ 'beneficiaryId' | t }} {{ table.sortIndicator('id') }}
              </th>
              <th class="cursor-pointer px-3 py-2" (click)="table.toggleSort('name')">
                {{ 'name' | t }} {{ table.sortIndicator('name') }}
              </th>
              <th class="cursor-pointer px-3 py-2" (click)="table.toggleSort('state')">
                {{ 'state' | t }} {{ table.sortIndicator('state') }}
              </th>
              <th class="cursor-pointer px-3 py-2" (click)="table.toggleSort('district')">
                {{ 'district' | t }} {{ table.sortIndicator('district') }}
              </th>
              <th class="cursor-pointer px-3 py-2" (click)="table.toggleSort('comments')">
                {{ 'comments' | t }} {{ table.sortIndicator('comments') }}
              </th>
              <th class="cursor-pointer px-3 py-2" (click)="table.toggleSort('lastCall')">
                {{ 'lastCall' | t }} {{ table.sortIndicator('lastCall') }}
              </th>
              <th class="cursor-pointer px-3 py-2" (click)="table.toggleSort('callCount')">
                {{ 'callCount' | t }} {{ table.sortIndicator('callCount') }}
              </th>
              <th class="px-3 py-2">{{ 'call' | t }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.paged(); track $index) {
              <tr class="border-t border-border">
                <td class="px-3 py-2">{{ table.serial($index) }}</td>
                <td class="px-3 py-2">{{ row.beneficiaryID }}</td>
                <td class="px-3 py-2">{{ row.FirstName }} {{ row.LastName }}</td>
                <td class="px-3 py-2">{{ row.State }}</td>
                <td class="px-3 py-2">{{ row.District }}</td>
                <td class="px-3 py-2">{{ comments(row) }}</td>
                <td class="px-3 py-2">{{ lastCall(row) }}</td>
                <td class="px-3 py-2">{{ row.callCounter }}</td>
                <td class="px-3 py-2">
                  <button
                    type="button"
                    class="text-primary hover:text-primary/80"
                    [title]="'callBeneficiary' | t"
                    [attr.aria-label]="'callBeneficiary' | t"
                    (click)="dial(row)"
                  >
                    <ng-icon name="lucidePhoneOutgoing" size="18" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="9" class="px-3 py-6 text-center text-muted-foreground">
                  {{ 'noRecordsFound' | t }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="text-muted-foreground">{{ 'totalCount' | t }}: {{ table.sorted().length }}</span>
        @if (table.sorted().length) {
          <div class="flex items-center gap-3">
            <span class="text-muted-foreground">Page {{ table.pageIndex() + 1 }} of {{ table.pageCount() }}</span>
            <button z-button zSize="sm" zType="outline" type="button" [zDisabled]="table.pageIndex() === 0" (click)="table.prev()">
              Prev
            </button>
            <button
              z-button
              zSize="sm"
              zType="outline"
              type="button"
              [zDisabled]="table.pageIndex() >= table.pageCount() - 1"
              (click)="table.next()"
            >
              {{ 'next' | t }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class EverwellWorklistTabComponent implements OnInit {
  private readonly outboundApi = inject(OutboundApiService);
  private readonly dialService = inject(OutboundDialService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);
  private readonly lang = inject(LanguageStore);

  protected readonly rows = signal<EverwellRow[]>([]);
  protected readonly table = new WorklistTable<EverwellRow>(4);
  protected readonly search = new FormControl('', { nonNullable: true });

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  constructor() {
    this.table.setAccessors({
      id: (r) => r.beneficiaryID,
      name: (r) => `${r.FirstName ?? ''} ${r.LastName ?? ''}`.trim(),
      state: (r) => r.State,
      district: (r) => r.District,
      comments: (r) => this.comments(r),
      lastCall: (r) => (r.lastCall != null ? Number(r.lastCall) : null),
      callCount: (r) => r.callCounter,
    });
  }

  ngOnInit(): void {
    const serviceId = this.serviceId();
    const userId = this.sessionStore.userId();
    if (serviceId == null || userId == null) {
      return;
    }
    this.outboundApi.getEverwellOutboundWorklist(serviceId, userId).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.data) ? (res.data as EverwellRow[]) : [];
        this.rows.set(rows);
        this.table.setRows(rows);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load the worklist', 'error'),
    });
  }

  protected comments(row: EverwellRow): string {
    const value = row.comments;
    if (value == null || value === 'NaN' || (typeof value === 'number' && isNaN(value))) {
      return 'N/A';
    }
    return String(value);
  }

  /** Old everwell HTML showed `lastCall` RAW (no date pipe), with a `!== 'NaN'` guard —
   * kept faithful (the backend may send a preformatted string). */
  protected lastCall(row: EverwellRow): string {
    return (row.callCounter ?? 0) > 0 && row.lastCall != null && row.lastCall !== 'NaN'
      ? String(row.lastCall)
      : 'N/A';
  }

  protected filter(): void {
    const term = this.search.value.trim().toLowerCase();
    if (!term) {
      this.table.setRows(this.rows());
      return;
    }
    this.table.setRows(
      this.rows().filter((row) =>
        [row.FirstName, row.PrimaryNumber, row.beneficiaryID].some((v) =>
          String(v ?? '').toLowerCase().includes(term),
        ),
      ),
    );
  }

  protected dial(row: EverwellRow): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.callStore.everwellCallNotConnected.set(null);
    this.callStore.checkEverwellResponse.set(false);
    this.callStore.feedbackData.set([]);
    this.callStore.updatedFeedbackList.set([]);
    this.callStore.outboundBenRegID.set(row.beneficiaryRegId ?? null);
    this.callStore.outboundEverwellData.set(row as Record<string, unknown>);

    this.outboundApi.checkIfAlreadyCalled(row.eapiId ?? '', serviceId).subscribe({
      next: (res) => {
        // Old guard read isCompleted off the UNWRAPPED response `.data`, acting only when the
        // flag is present: true → already-called alert, false → dial, absent → nothing.
        const isCompleted = (res?.data as { isCompleted?: boolean } | undefined)?.isCompleted;
        if (isCompleted == null) {
          return;
        }
        if (isCompleted === true) {
          this.notify.alert(this.lang.t('callAlreadyCompleted'), 'info');
          return;
        }
        this.dialService.dial(row.PrimaryNumber ?? '', ENCRYPTED_KEYS.isEverwellCall);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Something went wrong', 'error'),
    });
  }

  protected backToDashboard(): void {
    this.router.navigate(['/MultiRoleScreenComponent/dashboard']);
  }
}
