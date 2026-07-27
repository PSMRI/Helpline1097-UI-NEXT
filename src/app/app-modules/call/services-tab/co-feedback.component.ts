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
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { CoServicesApiService } from '@/app-modules/core/services/co-services-api.service';
import { LocationApiService } from '@/app-modules/core/services/location-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { DistrictRow, RegistrationData, SubServiceType, TalukRow } from '@/app-modules/core/models';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { numOrNull } from '@/app-modules/core/utils/select-value';

/**
 * Feedback service tab (old `co-feedback-services`, the largest tab). Captures a
 * feedback/complaint (location + designation + type + severity + date + description +
 * consent) and submits via `co/saveBenFeedback`. Deferred within Phase 6 (flagged): the
 * institution dropdown, the dual-mode history search (id/phone) and the status modal.
 */
@Component({
  selector: 'app-co-feedback',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective, ...ZardSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label class="flex flex-col gap-1.5 text-sm">
        <span>State <span class="text-destructive">*</span></span>
        <z-select formControlName="state" zPlaceholder="Select state" (zValueChange)="onStateChange($event)">
          @for (s of states(); track s.stateID) {
            <z-select-item [zValue]="s.stateID + ''">{{ s.stateName }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>District <span class="text-destructive">*</span></span>
        <z-select formControlName="district" zPlaceholder="Select district" (zValueChange)="onDistrictChange($event)">
          @for (d of districts(); track d.districtID) {
            <z-select-item [zValue]="d.districtID + ''">{{ d.districtName }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>Taluk</span>
        <z-select formControlName="taluk" zPlaceholder="Select taluk">
          @for (t of taluks(); track t.blockID) {
            <z-select-item [zValue]="t.blockID + ''">{{ t.blockName }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>Designation <span class="text-destructive">*</span></span>
        <z-select formControlName="designation" zPlaceholder="Select designation">
          @for (d of designations(); track d.designationID) {
            <z-select-item [zValue]="d.designationID + ''">{{ d.designationName }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>Feedback Type <span class="text-destructive">*</span></span>
        <z-select formControlName="feedbackType" zPlaceholder="Select type">
          @for (t of feedbackTypes(); track t.feedbackTypeID) {
            <z-select-item [zValue]="t.feedbackTypeID + ''">{{ t.feedbackTypeName }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>Severity <span class="text-destructive">*</span></span>
        <z-select formControlName="severity" zPlaceholder="Select severity">
          @for (s of severities(); track s.severityID) {
            <z-select-item [zValue]="s.severityID + ''">{{ s.severityTypeName }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>Date of Incident</span>
        <input z-input formControlName="serviceAvailDate" type="date" />
      </label>
      <label class="flex flex-col gap-1.5 text-sm sm:col-span-2 lg:col-span-3">
        <span>Description <span class="text-destructive">*</span></span>
        <textarea
          z-input
          formControlName="feedback"
          maxlength="5000"
          rows="3"
          placeholder="Describe the feedback / complaint"
        ></textarea>
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" formControlName="beneficiaryConsent" />
        <span>Beneficiary consent</span>
      </label>
      <div class="flex items-end justify-end sm:col-span-2 lg:col-span-3">
        <button z-button type="submit" [zDisabled]="form.invalid" [zLoading]="saving()">
          Submit Feedback
        </button>
      </div>
    </form>
  `,
})
export class CoFeedbackComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CoServicesApiService);
  private readonly locationApi = inject(LocationApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);

  /** Shared masters fetched ONCE by the co-services host. */
  readonly serviceTypes = input<SubServiceType[]>([]);
  readonly states = input<RegistrationData['states']>([]);
  readonly serviceProvided = output<void>();

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  private readonly subServiceId = computed(
    () =>
      this.serviceTypes().find((t) => t.subServiceName?.toUpperCase().includes('FEED'))
        ?.subServiceID ?? null,
  );

  protected readonly districts = signal<DistrictRow[]>([]);
  protected readonly taluks = signal<TalukRow[]>([]);
  protected readonly designations = signal<{ designationID?: number; designationName?: string }[]>([]);
  protected readonly feedbackTypes = signal<{ feedbackTypeID?: number; feedbackTypeName?: string }[]>([]);
  protected readonly severities = signal<{ severityID?: number; severityTypeName?: string }[]>([]);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    state: this.fb.control<string | null>(null, Validators.required),
    district: this.fb.control<string | null>(null, Validators.required),
    taluk: this.fb.control<string | null>(null),
    designation: this.fb.control<string | null>(null, Validators.required),
    feedbackType: this.fb.control<string | null>(null, Validators.required),
    severity: this.fb.control<string | null>(null, Validators.required),
    serviceAvailDate: this.fb.control<string | null>(null),
    feedback: this.fb.control('', { nonNullable: true, validators: Validators.required }),
    beneficiaryConsent: this.fb.control(false, { nonNullable: true }),
  });

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    // states + sub-service id come from the host's shared fetch (inputs above).
    this.api.getDesignations().subscribe({
      next: (res) => this.designations.set(Array.isArray(res?.data) ? res.data : []),
      error: () => this.designations.set([]),
    });
    this.api.getFeedbackTypes(serviceId).subscribe({
      next: (res) => this.feedbackTypes.set(Array.isArray(res?.data) ? res.data : []),
      error: () => this.feedbackTypes.set([]),
    });
    this.api.getFeedbackSeverities(serviceId).subscribe({
      next: (res) => this.severities.set(Array.isArray(res?.data) ? res.data : []),
      error: () => this.severities.set([]),
    });
  }

  // Takes the emitted value: z-select fires zValueChange BEFORE its CVA writes the form
  // control, so reading the control here would see the previous selection.
  protected onStateChange(value: string | string[]): void {
    this.districts.set([]);
    this.taluks.set([]);
    this.form.patchValue({ district: null, taluk: null });
    const state = value as string;
    if (!state) {
      return;
    }
    this.locationApi.getDistricts(state).subscribe({
      next: (res) => this.districts.set(res?.data ?? []),
      error: () => this.districts.set([]),
    });
  }

  protected onDistrictChange(value: string | string[]): void {
    this.taluks.set([]);
    this.form.patchValue({ taluk: null });
    const district = value as string;
    if (!district) {
      return;
    }
    this.locationApi.getTaluks(district).subscribe({
      next: (res) => this.taluks.set(res?.data ?? []),
      error: () => this.taluks.set([]),
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const serviceId = this.serviceId();
    this.saving.set(true);
    this.api
      .saveBenFeedback({
        stateID: numOrNull(v.state),
        districtID: numOrNull(v.district),
        blockID: numOrNull(v.taluk),
        designationID: numOrNull(v.designation),
        feedbackTypeID: numOrNull(v.feedbackType),
        severityID: numOrNull(v.severity),
        feedback: v.feedback.trim() || null,
        beneficiaryRegID: this.callStore.beneficiaryRegId(),
        serviceAvailDate: v.serviceAvailDate ?? null,
        serviceID: serviceId,
        subServiceID: this.subServiceId(),
        userID: this.sessionStore.userId(),
        createdBy: this.sessionStore.user()?.userName,
        benCallID: this.callStore.benCallID(),
        '1097ServiceID': serviceId,
        beneficiaryConsent: v.beneficiaryConsent,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          const requestID = (res?.data as { requestID?: string } | null)?.requestID;
          this.notify.alert(
            `Feedback submitted${requestID ? ` (ID ${requestID})` : ''}`,
            'success',
          );
          this.form.reset({ beneficiaryConsent: false });
          this.serviceProvided.emit();
        },
        error: (err: { errorMessage?: string }) => {
          this.saving.set(false);
          this.notify.alert(err?.errorMessage ?? 'Failed to submit feedback', 'error');
        },
      });
  }
}
