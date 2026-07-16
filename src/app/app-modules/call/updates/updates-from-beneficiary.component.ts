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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { BeneficiaryApiService } from '@/app-modules/core/services/beneficiary-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { BeneficiaryRecord, RegistrationData } from '@/app-modules/core/models';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** Old hardcoded `sourceOfInfo` list (id 7 = Not Disclosed disables the rest). */
const SOURCE_OF_INFO = [
  { id: 1, name: 'Pamphlet' },
  { id: 2, name: 'Radio' },
  { id: 3, name: 'Television' },
  { id: 4, name: 'Family and Friends' },
  { id: 5, name: 'Healthcare Worker' },
  { id: 6, name: 'Others' },
  { id: 8, name: 'Newspaper' },
  { id: 7, name: 'Not Disclosed' },
];

/**
 * "Other Details" slide (old `updates-from-beneficiary`). Edits occupation / education /
 * sexual orientation / place of work / HIV status / remarks / source-of-information on the
 * already-selected beneficiary, then persists the WHOLE beneficiary object via
 * `beneficiary/update` with the nine change-flags the backend contract expects.
 */
@Component({
  selector: 'app-updates-from-beneficiary',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective, ...ZardSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label class="flex flex-col gap-1.5 text-sm">
        <span>Occupation</span>
        <z-select formControlName="occupationID" zPlaceholder="Select">
          @for (o of occupations(); track o.occupationID) {
            <z-select-item [zValue]="o.occupationID + ''">{{ o.occupationType }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>Education</span>
        <z-select formControlName="educationID" zPlaceholder="Select">
          @for (e of educations(); track e.educationID) {
            <z-select-item [zValue]="e.educationID + ''">{{ e.educationType }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>Sexual Orientation</span>
        <z-select formControlName="sexualOrientationID" zPlaceholder="Select">
          @for (s of orientations(); track s.sexualOrientationId) {
            <z-select-item [zValue]="s.sexualOrientationId + ''">{{ s.sexualOrientation }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>Place of Work</span>
        <input z-input formControlName="placeOfWork" type="text" maxlength="25" placeholder="Place of work" />
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>HIV Status</span>
        <z-select formControlName="isHIVPos" zPlaceholder="Not disclosed">
          <z-select-item zValue="yes">Yes</z-select-item>
          <z-select-item zValue="no">No</z-select-item>
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>Came to know from</span>
        <z-select formControlName="sourceOfInformation" zPlaceholder="Select">
          @for (s of sources; track s.id) {
            <z-select-item [zValue]="s.id + ''">{{ s.name }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm sm:col-span-2 lg:col-span-3">
        <span>Remarks</span>
        <textarea z-input formControlName="remarks" maxlength="300" rows="2" placeholder="Remarks"></textarea>
      </label>
      <div class="flex items-end justify-end sm:col-span-2 lg:col-span-3">
        <button z-button type="submit" [zDisabled]="form.pristine" [zLoading]="saving()">
          Save Other Details
        </button>
      </div>
    </form>
  `,
})
export class UpdatesFromBeneficiaryComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly beneficiaryApi = inject(BeneficiaryApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  protected readonly sources = SOURCE_OF_INFO;
  protected readonly occupations = signal<RegistrationData['beneficiaryOccupations']>([]);
  protected readonly educations = signal<RegistrationData['i_BeneficiaryEducation']>([]);
  protected readonly orientations = signal<RegistrationData['sexualOrientations']>([]);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    occupationID: this.fb.control<string | null>(null),
    educationID: this.fb.control<string | null>(null),
    sexualOrientationID: this.fb.control<string | null>(null),
    placeOfWork: this.fb.control<string | null>(null),
    isHIVPos: this.fb.control<string | null>(null),
    sourceOfInformation: this.fb.control<string | null>(null),
    remarks: this.fb.control<string | null>(null),
  });

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.beneficiaryApi.getRegistrationData(serviceId).subscribe({
      next: (res) => {
        this.occupations.set(res?.data?.beneficiaryOccupations ?? []);
        this.educations.set(res?.data?.i_BeneficiaryEducation ?? []);
        this.orientations.set(res?.data?.sexualOrientations ?? []);
      },
      error: () => {
        // Old app only logged this.
      },
    });
    this.populateFromBeneficiary();
  }

  /** Old `PopulateUpdateData` — prefill from the already-selected beneficiary. */
  private populateFromBeneficiary(): void {
    const ben = this.callStore.beneficiary() as BeneficiaryRecord;
    if (!ben || !ben.i_bendemographics) {
      return;
    }
    const str = (v: unknown) => (v != null ? String(v) : null);
    this.form.patchValue({
      occupationID: str(ben.i_bendemographics.occupationID),
      educationID: str(ben.i_bendemographics.educationID),
      sexualOrientationID: str(ben.sexualOrientationID),
      placeOfWork: ben.placeOfWork ?? null,
      isHIVPos: ben.isHIVPos ? ben.isHIVPos.toLowerCase() : null,
      remarks: ben.remarks ?? null,
      sourceOfInformation: ben.sourceOfInformation ?? null,
    });
  }

  protected submit(): void {
    const v = this.form.getRawValue();
    const num = (s: string | null) => (s ? Number(s) : null);
    const ben = { ...(this.callStore.beneficiary() as BeneficiaryRecord) };
    // Ensure the registration id is present (authoritative store value) before updating.
    ben.beneficiaryRegID = ben.beneficiaryRegID ?? this.callStore.beneficiaryRegId() ?? undefined;
    if (ben.beneficiaryRegID == null) {
      this.notify.alert('No beneficiary selected', 'error');
      return;
    }
    ben.i_bendemographics = {
      ...(ben.i_bendemographics ?? {}),
      occupationID: num(v.occupationID),
      educationID: num(v.educationID),
    };
    ben.sexualOrientationID = num(v.sexualOrientationID);
    ben.placeOfWork = v.placeOfWork?.trim() || null;
    ben.isHIVPos = v.isHIVPos;
    ben.remarks = v.remarks?.trim() || null;
    ben.sourceOfInformation = v.sourceOfInformation;
    ben.is1097 = true;
    // Old change-flag battery — the backend contract keys off these.
    ben.changeInSelfDetails = true;
    ben.changeInAddress = true;
    ben.changeInContacts = true;
    ben.changeInIdentities = true;
    ben.changeInOtherDetails = true;
    ben.changeInFamilyDetails = true;
    ben.changeInAssociations = true;
    ben.changeInBankDetails = false;
    ben.changeInBenImage = false;

    this.saving.set(true);
    this.beneficiaryApi.updateBeneficiary(ben).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res?.statusCode === 200) {
          this.callStore.beneficiary.set(ben as Record<string, unknown>);
          this.form.markAsPristine();
          this.notify.alert('Other details saved', 'success');
        } else {
          this.notify.alert(res?.errorMessage ?? 'Failed to save details', 'error');
        }
      },
      error: (err: { errorMessage?: string }) => {
        this.saving.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to save details', 'error');
      },
    });
  }
}
