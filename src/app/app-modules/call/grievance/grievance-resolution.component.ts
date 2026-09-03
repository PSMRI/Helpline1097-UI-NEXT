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

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { RestrictInputDirective } from '@/app-modules/core/directives/restrict-input.directive';
import { TEXTAREA_BLOCK } from '@/app-modules/core/directives/input-patterns';
import { CallApiService } from '@/app-modules/core/services/call-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { OutboundApiService } from '@/app-modules/core/services/outbound-api.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { buildStartCallRequest, captureStartCallResponse } from '../start-call.helpers';

/** Old grievance-resolution `resolutionMaster` — the two dispositions. */
const RESOLUTION_OPTIONS = ['Resolved', 'Unresolved'];

/**
 * Grievance-resolution slide (old `grievance-resolution-details`, ~183 lines) — the first
 * step of the 2-step grievance outbound variant. It reads the complaint the outbound
 * worklist handed off (`CallStore.outboundGrievanceData`), opens the outbound call record
 * (`call/startCall`, faithful to the old `startOutBoundCall`), shows the complaint subject /
 * body / prior transactions read-only, and submits the agent's disposition + remarks via
 * `saveComplaintResolution`. The grievance worklist screen that dials and populates the
 * hand-off data is a supervisor/outbound surface (Phase 7).
 */
@Component({
  selector: 'app-grievance-resolution',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective, RestrictInputDirective, ...ZardSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <!-- Complaint (read-only, from the outbound hand-off) -->
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1 text-sm">
          <span class="text-muted-foreground">Subject of Complaint</span>
          <span class="font-medium">{{ complaintSubject() || '—' }}</span>
        </div>
        <div class="flex flex-col gap-1 text-sm">
          <span class="text-muted-foreground">Complaint ID</span>
          <span class="font-medium">{{ complaintID() ?? '—' }}</span>
        </div>
        <div class="flex flex-col gap-1 text-sm sm:col-span-2">
          <span class="text-muted-foreground">Complaint</span>
          <span class="whitespace-pre-line font-medium">{{ complaint() || '—' }}</span>
        </div>
      </div>

      <!-- Prior transactions (old "Previous Transaction History" dialog, inlined) -->
      @if (transactions().length) {
        <div class="overflow-x-auto rounded-md border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th class="px-3 py-2">Resolution</th>
                <th class="px-3 py-2">Remarks</th>
                <th class="px-3 py-2">By</th>
                <th class="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              @for (t of transactions(); track $index) {
                <tr class="border-t border-border">
                  <td class="px-3 py-2">{{ t.complaintResolution || '—' }}</td>
                  <td class="px-3 py-2">{{ t.remarks || '—' }}</td>
                  <td class="px-3 py-2">{{ t.createdBy || '—' }}</td>
                  <td class="px-3 py-2">{{ t.createdDate || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Resolution form -->
      <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Resolution <span class="text-destructive">*</span></span>
          <z-select formControlName="complaintResolution" zPlaceholder="Select resolution">
            @for (r of resolutionOptions; track r) {
              <z-select-item [zValue]="r">{{ r }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span>Remarks</span>
          <textarea
            z-input
            formControlName="remark"
            maxlength="5000"
            rows="3"
            placeholder="Resolution remarks"
            [appRestrictInput]="textAreaBlock"
          ></textarea>
          <span class="self-end text-xs text-muted-foreground">{{ remarkCount() }}/5000</span>
        </label>
        <div class="flex items-end justify-end sm:col-span-2">
          <button z-button type="submit" [zDisabled]="form.invalid" [zLoading]="saving()">
            Submit Resolution
          </button>
        </div>
      </form>
    </div>
  `,
})
export class GrievanceResolutionComponent implements OnInit {
  protected readonly textAreaBlock = TEXTAREA_BLOCK;

  private readonly fb = inject(FormBuilder);
  private readonly outboundApi = inject(OutboundApiService);
  private readonly callApi = inject(CallApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly resolutionOptions = RESOLUTION_OPTIONS;

  private readonly grievanceData = computed(() => this.callStore.outboundGrievanceData() ?? {});
  protected readonly complaintID = computed(() => this.grievanceData()['complaintID'] as number | string | undefined);
  protected readonly complaintSubject = computed(
    () => (this.grievanceData()['subjectOfComplaint'] as string | undefined) ?? '',
  );
  protected readonly complaint = computed(() => (this.grievanceData()['complaint'] as string | undefined) ?? '');
  protected readonly transactions = computed(
    () =>
      (this.grievanceData()['transactions'] as
        | { complaintResolution?: string; remarks?: string; createdBy?: string; createdDate?: string }[]
        | undefined) ?? [],
  );

  protected readonly saving = signal(false);
  /** Live char count (old `count`/`updateCount`) — a signal because zoneless CD won't track
   * a plain reactive-form value across keystrokes. */
  protected readonly remarkCount = signal(0);

  protected readonly form = this.fb.group({
    complaintResolution: this.fb.control<string | null>(null, Validators.required),
    remark: this.fb.control<string | null>(null),
  });

  ngOnInit(): void {
    // The worklist row carries the backend's `beneficiaryRegId` (lowercase d); both
    // casings are read, and the old startCall gate did NOT require a regId.
    const data = this.grievanceData();
    const regId = (data['beneficiaryRegID'] ?? data['beneficiaryRegId']) as
      | number
      | string
      | undefined;
    if (regId != null) {
      this.callStore.beneficiaryRegId.set(regId);
    }
    if (
      this.callStore.currentCampaign() === 'OUTBOUND' &&
      Object.keys(data).length > 0 &&
      this.callStore.benCallID() == null
    ) {
      this.startOutboundCall();
    }
    // Drive the char counter (old `updateCount`) from the control's value stream.
    this.form.controls.remark.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.remarkCount.set((v ?? '').length));
    // Old template: `[required]="complaintResolution === 'Unresolved'"` — an Unresolved
    // disposition cannot be submitted without remarks.
    this.form.controls.complaintResolution.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const remark = this.form.controls.remark;
        if (value === 'Unresolved') {
          remark.addValidators(Validators.required);
        } else {
          remark.removeValidators(Validators.required);
        }
        remark.updateValueAndValidity();
      });
  }

  private startOutboundCall(): void {
    const data = this.grievanceData();
    const request = buildStartCallRequest(this.sessionStore, this.callStore, {
      phoneNo: (data['primaryNumber'] as string | undefined) ?? null,
      beneficiaryRegID:
        ((data['beneficiaryRegID'] ?? data['beneficiaryRegId']) as number | string | undefined) ??
        null,
    });
    this.callApi.startCall(request).subscribe({
      next: (res) => captureStartCallResponse(res, this.callStore),
      error: (err: { errorMessage?: string }) => {
        this.notify.alert(err?.errorMessage ?? 'Failed to start call', 'error');
      },
    });
  }

  protected submit(): void {
    if (this.saving()) {
      return; // in-flight save — ignore double-clicks/Enter repeats
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.outboundApi
      .saveComplaintResolution({
        complaintID: this.complaintID() ?? null,
        complaintResolution: v.complaintResolution,
        remarks: v.remark?.trim() || null,
        beneficiaryRegID: this.callStore.beneficiaryRegId(),
        providerServiceMapID: this.sessionStore.currentServiceId() ?? null,
        userID: this.sessionStore.userId(),
        createdBy: this.sessionStore.user()?.userName,
        benCallID: this.callStore.benCallID(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notify.alert('Resolution submitted', 'success');
          this.form.markAsPristine();
        },
        error: (err: { errorMessage?: string }) => {
          this.saving.set(false);
          this.notify.alert(err?.errorMessage ?? 'Failed to submit resolution', 'error');
        },
      });
  }
}
