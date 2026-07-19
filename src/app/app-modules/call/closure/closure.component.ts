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
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { CallApiService } from '@/app-modules/core/services/call-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import {
  ENCRYPTED_KEYS,
  SessionStorageService,
} from '@/app-modules/core/services/session-storage.service';
import { CallSummary, CallType, CallTypeGroup, CloseCallRequest } from '@/app-modules/core/models';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Closure slide (old `closure`). Call-type group → sub-type (the option value is the old
 * CSV `"{callTypeID},{fitToBlock},{fitForFollowUp}"`), remarks, an optional follow-up block
 * (shown when the sub-type is fit-for-follow-up), and a transfer path (call type "Transfer"
 * → campaign/skill → `cti/transferCall` then a forced submit-close). Submit & Continue vs
 * Submit & Close build the faithful `call/closeCall` payload (the misspelled
 * `prefferedDateTime` is the backend contract). Everwell/grievance outbound close branches
 * arrive with their worklists (6f).
 */
@Component({
  selector: 'app-closure',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective, ...ZardSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      @if (summary(); as s) {
        <div class="grid grid-cols-2 gap-2 rounded-md border border-border p-3 text-sm sm:grid-cols-4">
          <div><span class="text-muted-foreground">Information:</span> {{ s.informationServices || '—' }}</div>
          <div><span class="text-muted-foreground">Counselling:</span> {{ s.counsellingServices || '—' }}</div>
          <div><span class="text-muted-foreground">Referral:</span> {{ s.referralServices || '—' }}</div>
          <div><span class="text-muted-foreground">Feedback:</span> {{ s.feedbackServices || '—' }}</div>
        </div>
      }

      <form [formGroup]="form" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Call Type <span class="text-destructive">*</span></span>
          <z-select formControlName="callType" zPlaceholder="Select call type" (zValueChange)="onCallTypeChange()">
            @for (g of callGroups(); track g) {
              <z-select-item [zValue]="g">{{ g }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Call Sub-Type <span class="text-destructive">*</span></span>
          <z-select formControlName="callSubType" zPlaceholder="Select sub-type" (zValueChange)="onSubTypeChange()">
            @for (st of subTypes(); track st.callTypeID) {
              <z-select-item [zValue]="subTypeValue(st)">{{ st.callType }}</z-select-item>
            }
          </z-select>
        </label>

        @if (transferValid()) {
          <label class="flex flex-col gap-1.5 text-sm">
            <span>Transfer Campaign <span class="text-destructive">*</span></span>
            <z-select formControlName="campaignName" zPlaceholder="Select campaign" (zValueChange)="onCampaignChange()">
              @for (c of campaigns(); track c) {
                <z-select-item [zValue]="c">{{ c }}</z-select-item>
              }
            </z-select>
          </label>
          <label class="flex flex-col gap-1.5 text-sm">
            <span>Skill</span>
            <z-select formControlName="campaignSkill" zPlaceholder="Select skill">
              @for (s of skills(); track s) {
                <z-select-item [zValue]="s">{{ s }}</z-select-item>
              }
            </z-select>
          </label>
        }

        <label class="flex flex-col gap-1.5 text-sm sm:col-span-2 lg:col-span-3">
          <span>Remarks</span>
          <input z-input formControlName="remarks" type="text" maxlength="100" placeholder="Remarks" />
        </label>

        <!-- Old IVR-feedback checkbox: Valid calls only, hidden on Everwell -->
        @if (showFeedbackFlag() && !isEverwell) {
          <label class="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
            <input type="checkbox" formControlName="isFeedback" />
            <span>IVR Feedback Required</span>
          </label>
        }

        @if (showFollowUp()) {
          <label class="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
            <input type="checkbox" formControlName="isFollowupRequired" />
            <span>Follow-up required</span>
          </label>
          @if (form.controls.isFollowupRequired.value) {
            <label class="flex flex-col gap-1.5 text-sm">
              <span>Preferred Date <span class="text-destructive">*</span></span>
              <input z-input formControlName="prefferedDateTime" type="date" [min]="minDate" />
            </label>
            <label class="flex flex-col gap-1.5 text-sm">
              <span>Reason <span class="text-destructive">*</span></span>
              <input z-input formControlName="requestedFor" type="text" maxlength="200" placeholder="Follow-up reason" />
            </label>
            <label class="flex flex-col gap-1.5 text-sm">
              <span>Language <span class="text-destructive">*</span></span>
              <z-select formControlName="preferredLanguageName" zPlaceholder="Select language">
                @for (l of languages(); track l.languageID) {
                  <z-select-item [zValue]="l.languageName + ''">{{ l.languageName }}</z-select-item>
                }
              </z-select>
            </label>
            <label class="flex flex-col gap-1.5 text-sm">
              <span>Requested Service <span class="text-destructive">*</span></span>
              <z-select formControlName="requestedServiceID" zPlaceholder="Select service">
                @for (s of subServices(); track s.subServiceID) {
                  <z-select-item [zValue]="s.subServiceID + ''">{{ s.subServiceName }}</z-select-item>
                }
              </z-select>
            </label>
          }
        }
      </form>

      <div class="flex items-center justify-end gap-3">
        @if (transferValid()) {
          <!-- Old Transfer disable: isCallDisconnected || Form.invalid -->
          <button
            z-button
            type="button"
            [zDisabled]="custDisconnected() || form.invalid"
            [zLoading]="busy()"
            (click)="transfer()"
          >
            Transfer
          </button>
        } @else {
          <!-- Old Submit & Continue: hidden on OUTBOUND; disabled when the customer already
               disconnected or the call type is Invalid (Submit & Close keeps neither guard —
               a disconnected call must still be closable) -->
          @if (!isOutboundCampaign()) {
            <button
              z-button
              zType="outline"
              type="button"
              [zDisabled]="custDisconnected() || invalidType() || form.invalid || busy()"
              (click)="submit('continue')"
            >
              Submit &amp; Continue
            </button>
          }
          <button z-button zType="destructive" type="button" [zDisabled]="form.invalid || busy()" (click)="submit('close')">
            Submit &amp; Close
          </button>
        }
      </div>
    </div>
  `,
})
export class ClosureComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly callApi = inject(CallApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);
  private readonly storage = inject(SessionStorageService);

  /** Old `callClosed` — emits the campaign; the wizard clears flags and returns to dashboard. */
  readonly callClosed = output<string>();
  /** Old `closedContinue` — restart the wizard for a new service on the same call. */
  readonly closedContinue = output<void>();

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  protected readonly minDate = new Date().toISOString().slice(0, 10);

  private callTypeGroups: CallTypeGroup[] = [];
  protected readonly callGroups = signal<string[]>([]);
  protected readonly subTypes = signal<CallType[]>([]);
  protected readonly transferValid = signal(false);
  protected readonly showFollowUp = signal(false);
  /** Old `showFeedbackRequiredFlag` — the IVR-feedback checkbox shows only for Valid calls. */
  protected readonly showFeedbackFlag = signal(false);
  /** Old `callType.value == 'Invalid'` — Submit & Continue is blocked on Invalid calls. */
  protected readonly invalidType = signal(false);
  /** Old `isCallDisconnected` — blocks Submit & Continue / Transfer, NOT Submit & Close. */
  protected readonly custDisconnected = computed(() => this.callStore.custDisconnected() > 0);
  /** Old `*ngIf="current_campaign !== 'OUTBOUND'"` on Submit & Continue. */
  protected readonly isOutboundCampaign = computed(
    () => this.callStore.currentCampaign() === 'OUTBOUND',
  );
  /** Old `isEverwell` — the feedback checkbox is hidden on Everwell calls. */
  protected readonly isEverwell =
    this.storage.getItem(ENCRYPTED_KEYS.isEverwellCall) === 'yes';
  protected readonly campaigns = signal<string[]>([]);
  protected readonly skills = signal<string[]>([]);
  protected readonly languages = signal<{ languageID?: number; languageName?: string }[]>([]);
  protected readonly subServices = signal<{ subServiceID?: number; subServiceName?: string }[]>([]);
  protected readonly summary = signal<CallSummary | null>(null);
  protected readonly busy = signal(false);

  protected readonly form = this.fb.group({
    callType: this.fb.control<string | null>(null, Validators.required),
    callSubType: this.fb.control<string | null>(null, Validators.required),
    campaignName: this.fb.control<string | null>(null),
    campaignSkill: this.fb.control<string | null>(null),
    remarks: this.fb.control<string | null>(null),
    isFeedback: this.fb.control(false, { nonNullable: true }),
    isFollowupRequired: this.fb.control(false, { nonNullable: true }),
    prefferedDateTime: this.fb.control<string | null>(null),
    requestedFor: this.fb.control<string | null>(null),
    preferredLanguageName: this.fb.control<string | null>(null),
    requestedServiceID: this.fb.control<string | null>(null),
  });

  constructor() {
    // The follow-up fields are required only while rendered (old template-driven `required`
    // attrs applied only while the *ngIf kept the controls in the form).
    this.form.controls.isFollowupRequired.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.syncFollowUpValidators());
  }

  /**
   * Old semantics: the follow-up controls carried `required` only while visible (checkbox
   * ticked on a fit-for-follow-up sub-type); hidden template-driven controls dropped out of
   * the form entirely, taking their validators with them.
   */
  private syncFollowUpValidators(): void {
    const required = this.showFollowUp() && this.form.controls.isFollowupRequired.value;
    const controls = [
      this.form.controls.prefferedDateTime,
      this.form.controls.requestedFor,
      this.form.controls.preferredLanguageName,
      this.form.controls.requestedServiceID,
    ];
    for (const control of controls) {
      if (required) {
        control.addValidators(Validators.required);
      } else {
        control.removeValidators(Validators.required);
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    const campaign = this.callStore.currentCampaign();
    this.callApi.getCallTypes(serviceId, campaign).subscribe({
      next: (res) => this.populateCallTypes(res?.data ?? []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load call types', 'error'),
    });
    this.callApi.getLanguages().subscribe({
      next: (res) => {
        const languages = Array.isArray(res?.data) ? res.data : [];
        this.languages.set(languages);
        // Old `getLanguages` pre-selected Hindi as the follow-up language.
        const hindi = (languages as { languageName?: string }[]).find(
          (l) => l.languageName?.toLowerCase() === 'hindi',
        );
        if (hindi?.languageName) {
          this.form.patchValue({ preferredLanguageName: hindi.languageName });
        }
      },
      error: () => this.languages.set([]),
    });
    this.callApi.getCampaignNames(this.sessionStore.currentServiceName() ?? '').subscribe({
      next: (res) => {
        const data = res?.data as { campaign?: { campaign_name?: string }[] } | null;
        this.campaigns.set((data?.campaign ?? []).map((c) => c.campaign_name ?? '').filter(Boolean));
      },
      error: () => this.campaigns.set([]),
    });
    this.callApi.getSubServiceTypes(serviceId, campaign).subscribe({
      next: (res) => this.subServices.set(Array.isArray(res?.data) ? res.data : []),
      error: () => this.subServices.set([]),
    });
    this.loadSummary();
  }

  /** Old `onView()` — (re)load the per-call service summary. Called by the wizard too. */
  loadSummary(): void {
    const benCallID = this.callStore.benCallID();
    if (benCallID == null) {
      return;
    }
    this.callApi.getCallSummary(benCallID).subscribe({
      next: (res) => this.summary.set(Array.isArray(res?.data) ? (res.data[0] ?? null) : null),
      error: () => this.summary.set(null),
    });
  }

  /** Old `populateCallTypes` — dropdown of group names, minus the "wrapup exceeds" group. */
  private populateCallTypes(groups: CallTypeGroup[]): void {
    this.callTypeGroups = groups;
    this.callGroups.set(
      groups
        .map((g) => g.callGroupType ?? '')
        .filter((g) => g && g.toLowerCase() !== 'wrapup exceeds'),
    );
  }

  /**
   * Composite option value split later: `callTypeID,fitToBlock,fitForFollowUp` (old CSV).
   * Missing flags interpolate to `''` exactly like the old Angular template did — a JS
   * template literal would stringify `undefined` to the literal word instead.
   */
  protected subTypeValue(st: CallType): string {
    return `${st.callTypeID},${st.fitToBlock ?? ''},${st.fitForFollowUp ?? ''}`;
  }

  protected onCallTypeChange(): void {
    const group = this.form.controls.callType.value;
    this.form.patchValue({ callSubType: null });
    this.subTypes.set([]);
    this.showFollowUp.set(false);
    this.transferValid.set(!!group && group.toLowerCase().startsWith('transfer'));
    // Old `sliderVisibility`: the IVR-feedback checkbox exists only for Valid calls, and
    // Submit & Continue is blocked outright on Invalid ones.
    const isValid = !!group && group.toUpperCase() === 'VALID';
    this.showFeedbackFlag.set(isValid);
    if (!isValid) {
      this.form.patchValue({ isFeedback: false });
    }
    this.invalidType.set(group === 'Invalid');
    const match = this.callTypeGroups.find((g) => g.callGroupType === group);
    this.subTypes.set(match?.callTypes ?? []);
    this.syncFollowUpValidators();
  }

  /** Old `sliderVisibility` — follow-up shows when the sub-type's fitForFollowUp is "true". */
  protected onSubTypeChange(): void {
    const value = this.form.controls.callSubType.value ?? '';
    const fitForFollowUp = value.split(',')[2];
    this.showFollowUp.set(fitForFollowUp === 'true');
    // A hidden checkbox left the old form entirely (`isFollowupRequired == undefined` →
    // coerced false in closeCall), so an unfit sub-type must clear it here too.
    if (fitForFollowUp !== 'true') {
      this.form.patchValue({ isFollowupRequired: false });
    }
    this.syncFollowUpValidators();
  }

  protected onCampaignChange(): void {
    this.skills.set([]);
    this.form.patchValue({ campaignSkill: null });
    const name = this.form.controls.campaignName.value;
    if (!name) {
      return;
    }
    this.callApi.getCampaignSkills(name).subscribe({
      next: (res) => {
        const data = res?.data as { response?: { skills?: { skill_name?: string }[] } } | null;
        this.skills.set((data?.response?.skills ?? []).map((s) => s.skill_name ?? '').filter(Boolean));
      },
      error: () => this.skills.set([]),
    });
  }

  /** Old `transferCall` — transfer then force a submit-close. */
  protected transfer(): void {
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.callApi
      .transferCall({
        transfer_from: this.sessionStore.agentId(),
        transfer_campaign_info: v.campaignName,
        skill_transfer_flag: v.campaignSkill ? '1' : '0',
        skill: v.campaignSkill,
        callType: v.callType,
        callTypeID: (v.callSubType ?? '').split(',')[0],
        agentIPAddress: undefined,
        benCallID: this.callStore.benCallID(),
      })
      .subscribe({
        next: () => this.closeCall('close', true),
        error: (err: { errorMessage?: string }) => {
          this.busy.set(false);
          this.notify.alert(err?.errorMessage ?? 'Transfer failed', 'error');
        },
      });
  }

  protected submit(kind: 'continue' | 'close'): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (kind === 'continue') {
      this.notify
        .confirm('Provide a new service to this beneficiary?', 'Continue')
        .subscribe((ok) => {
          if (ok) {
            this.closeCall('continue', false);
          }
        });
    } else {
      this.closeCall('close', false);
    }
  }

  /** Old `closeCall` payload assembly (faithful field set incl. the CSV split + misspelling). */
  private closeCall(kind: 'continue' | 'close', transfer: boolean): void {
    const v = this.form.getRawValue();
    const csv = (v.callSubType ?? '').split(',');
    const campaign = this.callStore.currentCampaign();

    const request: CloseCallRequest = {
      benCallID: this.callStore.benCallID() ?? undefined,
      providerServiceMapID: this.serviceId() ?? undefined,
      createdBy: this.sessionStore.user()?.userName,
      agentID: this.sessionStore.agentId(),
      beneficiaryRegID: this.callStore.beneficiaryRegId(),
      callType: v.callType,
      callTypeID: csv[0] || null,
      // Old interpolation sent '' (never the word "undefined") when fitToBlock was absent.
      fitToBlock: csv[1] ?? '',
      remarks: v.remarks != null ? v.remarks.trim() : null,
      // Old `values.isFeedback = this.isFeedbackRequiredFlag` — sent on EVERY close.
      isFeedback: v.isFeedback ?? false,
      isFollowupRequired: v.isFollowupRequired ?? false,
      endCall: kind === 'close',
      isTransfered: transfer,
      IsOutbound: campaign === 'OUTBOUND',
    };
    if (campaign === 'OUTBOUND') {
      request.isCompleted = true;
    }
    // Old form dropped the hidden follow-up controls from `Form.value`, so the follow-up
    // block was only sent while the checkbox was ticked.
    if (v.isFollowupRequired && v.prefferedDateTime) {
      request.prefferedDateTime = new Date(v.prefferedDateTime).toJSON();
      request.requestedServiceID = v.requestedServiceID ? Number(v.requestedServiceID) : null;
      request.requestedFor = v.requestedFor;
      request.preferredLanguageName = v.preferredLanguageName;
    }

    if (this.callStore.benCallID() == null) {
      this.notify.alert('Cannot close the call: benCallID missing.', 'error');
      return;
    }
    this.busy.set(true);
    this.callApi.closeCall(request).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.alert('Call closed successfully', 'success');
        if (kind === 'close') {
          this.callClosed.emit(campaign ?? '');
        } else {
          this.form.reset({ isFeedback: false, isFollowupRequired: false });
          this.showFeedbackFlag.set(false);
          this.showFollowUp.set(false);
          this.invalidType.set(false);
          this.transferValid.set(false);
          // Keep the old Hindi pre-selection alive for the next service's follow-up.
          const hindi = this.languages().find((l) => l.languageName?.toLowerCase() === 'hindi');
          if (hindi?.languageName) {
            this.form.patchValue({ preferredLanguageName: hindi.languageName });
          }
          this.closedContinue.emit();
        }
      },
      error: (err: { errorMessage?: string }) => {
        this.busy.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to close the call', 'error');
      },
    });
  }
}
