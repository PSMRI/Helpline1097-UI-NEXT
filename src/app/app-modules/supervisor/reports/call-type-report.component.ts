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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import {
  clampReportEnd,
  maxReportDay,
  ReportsApiService,
  reportDatesValidator,
  saveBlob,
} from './reports-api.service';
import { dayBoundary, localDate } from '../allocation/allocation-api.service';
import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';
import { BeneficiaryApiService } from '@/app-modules/core/services/beneficiary-api.service';
import { LocationApiService } from '@/app-modules/core/services/location-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { CallType, CallTypeGroup, DistrictRow, RegistrationData } from '@/app-modules/core/models';
import { LanguageStore } from '@/app-modules/core/state/language.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Call Type Report (supervisor case 9): call type/sub-type cascade + demographic filters →
 * server-side XLSX blob. Same yesterday-cap/31-day window as the distribution reports; the
 * old payload sent day-boundary strings with a `.999Z` end.
 */
@Component({
  selector: 'app-call-type-report',
  imports: [
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardInputDirective,
    TranslatePipe,
    ...ZardSelectImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <h2 class="text-base font-semibold">{{ 'callTypeReport' | t }}</h2>
      <form class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" [formGroup]="form">
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'startDate' | t }} <span class="text-destructive">*</span></span>
          <input z-input formControlName="startDate" type="date" [max]="maxDay" (change)="onStartDateChange()" />
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'endDate' | t }} <span class="text-destructive">*</span></span>
          <input
            z-input
            formControlName="endDate"
            type="date"
            [min]="form.controls.startDate.value"
            [max]="maxEndDay()"
          />
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'callType' | t }}</span>
          <z-select formControlName="callType" [zPlaceholder]="'calltype' | t" (zValueChange)="onCallTypeChange($event)">
            @for (g of callGroups(); track g) {
              <z-select-item [zValue]="g">{{ g }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'callSub-type' | t }}</span>
          <z-select formControlName="callSubType" [zPlaceholder]="'callsubtype' | t">
            @for (st of subTypes(); track st.callTypeID) {
              <z-select-item [zValue]="st.callType + ''">{{ st.callType }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'state' | t }}</span>
          <z-select formControlName="state" [zPlaceholder]="'selectState' | t" (zValueChange)="onStateChange($event)">
            @for (s of states(); track s.stateID) {
              <z-select-item [zValue]="s.stateName + ''">{{ s.stateName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'district' | t }}</span>
          <z-select formControlName="district" [zPlaceholder]="'selectDistrict' | t">
            @for (d of districts(); track d.districtID) {
              <z-select-item [zValue]="d.districtName + ''">{{ d.districtName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'gender' | t }}</span>
          <z-select formControlName="gender" [zPlaceholder]="'selectGender' | t">
            @for (g of genders(); track g.genderID) {
              <z-select-item [zValue]="g.genderName + ''">{{ g.genderName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'language' | t }}</span>
          <z-select formControlName="language" [zPlaceholder]="'selectLanguage' | t">
            @for (l of languages(); track l.languageID) {
              <z-select-item [zValue]="l.languageName + ''">{{ l.languageName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'sexualOrientation' | t }}</span>
          <z-select formControlName="sexuality" [zPlaceholder]="'sexuality' | t">
            @for (s of orientations(); track s.sexualOrientationId) {
              <z-select-item [zValue]="s.sexualOrientation + ''">{{ s.sexualOrientation }}</z-select-item>
            }
          </z-select>
        </label>
        <div class="flex items-end">
          <button z-button type="button" [zDisabled]="form.invalid" [zLoading]="downloading()" (click)="download()">
            {{ 'downloadReport' | t }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class CallTypeReportComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ReportsApiService);
  private readonly beneficiaryApi = inject(BeneficiaryApiService);
  private readonly locationApi = inject(LocationApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly lang = inject(LanguageStore);

  private readonly callTypeGroups = signal<CallTypeGroup[]>([]);
  protected readonly callGroups = computed(() =>
    this.callTypeGroups()
      .map((g) => g.callGroupType ?? '')
      .filter(Boolean),
  );
  protected readonly subTypes = signal<CallType[]>([]);
  protected readonly states = signal<NonNullable<RegistrationData['states']>>([]);
  protected readonly districts = signal<DistrictRow[]>([]);
  protected readonly genders = signal<NonNullable<RegistrationData['m_genders']>>([]);
  protected readonly languages = signal<NonNullable<RegistrationData['m_language']>>([]);
  protected readonly orientations = signal<NonNullable<RegistrationData['sexualOrientations']>>([]);
  protected readonly downloading = signal(false);

  protected readonly maxDay = maxReportDay();
  protected readonly maxEndDay = signal(this.maxDay);

  protected readonly form = this.fb.group(
    {
      startDate: this.fb.control<string | null>(null, Validators.required),
      endDate: this.fb.control<string | null>(null, Validators.required),
      callType: this.fb.control<string | null>(null),
      callSubType: this.fb.control<string | null>(null),
      state: this.fb.control<string | null>(null),
      district: this.fb.control<string | null>(null),
      gender: this.fb.control<string | null>(null),
      language: this.fb.control<string | null>(null),
      sexuality: this.fb.control<string | null>(null),
    },
    { validators: reportDatesValidator(this.maxDay, () => this.maxEndDay()) },
  );

  ngOnInit(): void {
    const serviceId = this.sessionStore.currentServiceId();
    if (serviceId == null) {
      return;
    }
    this.api.getCallTypes(serviceId).subscribe({
      next: (res) => this.callTypeGroups.set(res?.data ?? []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load call types', 'error'),
    });
    this.beneficiaryApi.getRegistrationData(serviceId).subscribe({
      next: (res) => {
        if (res?.data) {
          this.states.set(res.data.states ?? []);
          this.genders.set(res.data.m_genders ?? []);
          this.languages.set(res.data.m_language ?? []);
          this.orientations.set(res.data.sexualOrientations ?? []);
        }
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load filters', 'error'),
    });
  }

  protected onStartDateChange(): void {
    const start = this.form.controls.startDate.value;
    if (!start) {
      return;
    }
    const end = clampReportEnd(start);
    this.maxEndDay.set(end);
    this.form.patchValue({ endDate: end });
  }

  // Handlers take the emitted value: z-select fires zValueChange BEFORE its CVA writes the
  // form control, so reading the control here would see the previous selection.
  protected onCallTypeChange(value: string | string[]): void {
    // Old getCallSubType never cleared the chosen sub-type — a stale one stays in the payload.
    this.subTypes.set(
      this.callTypeGroups().find((g) => g.callGroupType === (value as string))?.callTypes ?? [],
    );
  }

  protected onStateChange(value: string | string[]): void {
    this.districts.set([]);
    this.form.patchValue({ district: null });
    const state = this.states().find((s) => s.stateName === (value as string));
    if (state?.stateID == null) {
      return;
    }
    this.locationApi.getDistricts(state.stateID).subscribe({
      next: (res) => this.districts.set(res?.data ?? []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load districts', 'error'),
    });
  }

  protected download(): void {
    const v = this.form.getRawValue();
    if (!v.startDate || !v.endDate) {
      return;
    }
    const body: Record<string, unknown> = {
      providerServiceMapID: this.sessionStore.currentServiceId(),
      beneficiaryCallType: v.callType ?? undefined,
      beneficiaryCallSubType: v.callSubType ?? undefined,
      startTimestamp: dayBoundary(localDate(v.startDate), 'start'),
      // Old call-type report ended the window at .999 (unlike the distribution reports).
      endTimestamp: dayBoundary(localDate(v.endDate), 'end999'),
      state: v.state ?? undefined,
      district: v.district ?? undefined,
      gender: v.gender ?? undefined,
      beneficiaryPreferredLanguage: v.language ?? undefined,
      beneficiarySexualOrientation: v.sexuality ?? undefined,
      fileName: 'Call_Type_Report',
    };
    this.downloading.set(true);
    this.api.downloadReport('crmReports/getAllReportsByDate', body).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        if (blob) {
          saveBlob(blob, 'Call_Type_Report.xlsx');
          this.notify.alert(this.lang.t('callTypeReportDownloaded'), 'success');
        } else {
          this.notify.alert(this.lang.t('noDataFound'), 'info');
        }
      },
      error: (err: { status?: number }) => {
        this.downloading.set(false);
        if (err?.status === 500) {
          this.notify.alert(this.lang.t('noDataFound'), 'info');
        } else {
          this.notify.alert(this.lang.t('errorWhileFetchingReport'), 'error');
        }
      },
    });
  }
}
