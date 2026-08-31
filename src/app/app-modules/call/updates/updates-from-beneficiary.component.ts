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

import { RestrictInputDirective } from '@/app-modules/core/directives/restrict-input.directive';
import { TEXTAREA_BLOCK } from '@/app-modules/core/directives/input-patterns';
import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';
import { BeneficiaryApiService } from '@/app-modules/core/services/beneficiary-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { BeneficiaryRecord, RegistrationData } from '@/app-modules/core/models';
import { CallStore } from '@/app-modules/core/state/call.store';
import { LanguageStore } from '@/app-modules/core/state/language.store';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { numOrNull } from '@/app-modules/core/utils/select-value';

/** Old hardcoded `sourceOfInfo` list (id 7 = Not Disclosed disables the rest). */
/**
 * Old `sourceOfInfo`. The option VALUE is the source name, not the id — the backend stores
 * `sourceOfInformation` as a comma-separated list of these names.
 */
const SOURCE_OF_INFO = [
  { id: 1, name: 'Pamphlet', value: 'Pamphlet' },
  { id: 2, name: 'Radio', value: 'Radio' },
  { id: 3, name: 'Television', value: 'Television' },
  { id: 4, name: 'Family and Friends', value: 'Family and Friends' },
  { id: 5, name: 'Healthcare Worker', value: 'Healthcare Worker' },
  { id: 6, name: 'Others', value: 'Others' },
  { id: 8, name: 'Newspaper', value: 'Newspaper' },
  { id: 7, name: 'Not Disclosed', value: 'Not Disclosed' },
];

const NOT_DISCLOSED = 'Not Disclosed';

/**
 * Sentinel for the HIV-status "Not disclosed" option. The old app used `<md-option value="">`
 * and posted `isHIVPos: ""`, but the select rejects an empty option value — so carry a sentinel
 * in the form and map it back to `""` on submit.
 */
const HIV_NOT_DISCLOSED = '__not_disclosed__';

/** Coerce a z-select value to an array (multi-mode CVA can hand back a scalar). */
function asArray(value: string | string[] | null): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

/**
 * "Other Details" slide (old `updates-from-beneficiary`). Edits occupation / education /
 * sexual orientation / place of work / HIV status / remarks / source-of-information on the
 * already-selected beneficiary, then persists the WHOLE beneficiary object via
 * `beneficiary/update` with the nine change-flags the backend contract expects.
 */
@Component({
  selector: 'app-updates-from-beneficiary',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ZardButtonComponent,
    ZardInputDirective,
    RestrictInputDirective,
    ...ZardSelectImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label class="flex flex-col gap-1.5 text-sm">
        <span>{{ 'occupation' | t }}</span>
        <z-select formControlName="occupationID" zPlaceholder="Select">
          @for (o of occupations(); track o.occupationID) {
            <z-select-item [zValue]="o.occupationID + ''">{{ o.occupationType }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>{{ 'qualification' | t }}</span>
        <z-select formControlName="educationID" zPlaceholder="Select">
          @for (e of educations(); track e.educationID) {
            <z-select-item [zValue]="e.educationID + ''">{{ e.educationType }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>{{ 'sexualOrientation' | t }}</span>
        <z-select formControlName="sexualOrientationID" zPlaceholder="Select">
          @for (s of orientations(); track s.sexualOrientationId) {
            <z-select-item [zValue]="s.sexualOrientationId + ''">{{ s.sexualOrientation }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>{{ 'workPlace' | t }}</span>
        <input z-input formControlName="placeOfWork" type="text" maxlength="25" [placeholder]="'workPlace' | t" [appRestrictInput]="textAreaBlock" />
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>{{ 'hivQuestion' | t }} {{ 'hivQuestionCondition' | t }}</span>
        <z-select formControlName="isHIVPos" zPlaceholder="Not disclosed">
          <z-select-item zValue="yes">Yes</z-select-item>
          <z-select-item zValue="no">No</z-select-item>
          <z-select-item [zValue]="hivNotDisclosed">Not disclosed</z-select-item>
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span>{{ 'feedbackQuestion' | t }}</span>
        <z-select
          formControlName="sourceOfInformation"
          [zMultiple]="true"
          zPlaceholder="Select"
          (zSelectionChange)="onSourcesChange($event)"
        >
          @for (s of sources(); track s.id) {
            <z-select-item [zValue]="s.value" [zDisabled]="s.disabled">{{ s.name }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm sm:col-span-2 lg:col-span-3">
        <span>{{ 'remarks' | t }}</span>
        <textarea z-input formControlName="remarks" maxlength="300" rows="2" [placeholder]="'remarks' | t" [appRestrictInput]="textAreaBlock"></textarea>
        <span class="self-end text-xs text-muted-foreground">
          {{ form.controls.remarks.value?.length ?? 0 }}/300
        </span>
      </label>
      <div class="flex items-end justify-end sm:col-span-2 lg:col-span-3">
        <button z-button type="submit" [zDisabled]="form.pristine" [zLoading]="saving()">
          {{ 'update' | t }}
        </button>
      </div>
    </form>
  `,
})
export class UpdatesFromBeneficiaryComponent implements OnInit {
  protected readonly textAreaBlock = TEXTAREA_BLOCK;

  private readonly fb = inject(FormBuilder);
  private readonly beneficiaryApi = inject(BeneficiaryApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);
  private readonly lang = inject(LanguageStore);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  /** Option list with per-item disabled state (old `populateSourceOfInformation`). */
  protected readonly hivNotDisclosed = HIV_NOT_DISCLOSED;
  protected readonly sources = signal(SOURCE_OF_INFO.map((s) => ({ ...s, disabled: false })));
  /**
   * Full multi-selection — the reactive control alone is unreliable in multi mode. Mirrors the
   * old `cameToKnowFrom`: `undefined` until prefilled or touched (drives `undefined` vs `""`
   * in the payload), an array (possibly empty) thereafter.
   */
  protected readonly sourcesSelected = signal<string[] | undefined>(undefined);
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
    sourceOfInformation: this.fb.control<string[]>([], { nonNullable: true }),
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
    // Old app split the stored CSV of source names back into the multi-select (and left
    // `cameToKnowFrom` undefined when nothing was stored).
    const selectedSources = ben.sourceOfInformation
      ? String(ben.sourceOfInformation)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    this.form.patchValue({
      occupationID: str(ben.i_bendemographics.occupationID),
      educationID: str(ben.i_bendemographics.educationID),
      sexualOrientationID: str(ben.sexualOrientationID),
      placeOfWork: ben.placeOfWork ?? null,
      // Old `isHIVPos` defaulted to "" (the "Not disclosed" option).
      isHIVPos: ben.isHIVPos ? ben.isHIVPos.toLowerCase() : HIV_NOT_DISCLOSED,
      remarks: ben.remarks ?? null,
      sourceOfInformation: selectedSources ?? [],
    });
    this.sourcesSelected.set(selectedSources);
    // Prefill only sets the disabled state (old `populateSourceOfInformation`); it never
    // rewrites the stored selection, so an existing value is posted back untouched.
    this.applyNotDisclosedState(selectedSources ?? []);
  }

  /**
   * Old `checkInCaseNotDisclosed` + `populateSourceOfInformation`: selecting "Not Disclosed"
   * collapses the selection to just that value and disables every other option; clearing the
   * selection re-enables them.
   */
  protected onSourcesChange(value: string | string[]): void {
    const selected = asArray(value);
    if (selected.includes(NOT_DISCLOSED)) {
      // Already collapsed — don't write back (a fresh array would re-trigger the select).
      if (selected.length !== 1) {
        const only = [NOT_DISCLOSED];
        this.form.controls.sourceOfInformation.setValue(only);
        this.sourcesSelected.set(only);
        this.applyNotDisclosedState(only);
        return;
      }
      this.sourcesSelected.set([NOT_DISCLOSED]);
      this.applyNotDisclosedState([NOT_DISCLOSED]);
      return;
    }
    this.sourcesSelected.set(selected);
    this.applyNotDisclosedState(selected);
  }

  private applyNotDisclosedState(selected: string[]): void {
    const lock = selected.includes(NOT_DISCLOSED);
    this.sources.update((list) =>
      list.map((s) => ({ ...s, disabled: lock && s.value !== NOT_DISCLOSED })),
    );
  }

  protected submit(): void {
    const v = this.form.getRawValue();
    const ben = { ...(this.callStore.beneficiary() as BeneficiaryRecord) };
    // Ensure the registration id is present (authoritative store value) before updating.
    ben.beneficiaryRegID = ben.beneficiaryRegID ?? this.callStore.beneficiaryRegId() ?? undefined;
    if (ben.beneficiaryRegID == null) {
      this.notify.alert('No beneficiary selected', 'error');
      return;
    }
    ben.i_bendemographics = {
      ...(ben.i_bendemographics ?? {}),
      occupationID: numOrNull(v.occupationID),
      educationID: numOrNull(v.educationID),
    };
    // Old sent the raw form value — an unset orientation was `undefined` (key omitted
    // from the JSON), never null.
    ben.sexualOrientationID = v.sexualOrientationID != null ? Number(v.sexualOrientationID) : undefined;
    ben.placeOfWork = v.placeOfWork?.trim() || null;
    // "Not disclosed" (and an untouched control) post "" — the old app's default value.
    ben.isHIVPos = v.isHIVPos == null || v.isHIVPos === HIV_NOT_DISCLOSED ? '' : v.isHIVPos;
    ben.remarks = v.remarks?.trim() || null;
    // Old app posted `cameToKnowFrom ? cameToKnowFrom.toString() : undefined` — a CSV of source
    // NAMES. An empty array is truthy there, so a cleared selection posts "" (not undefined).
    const sources = this.sourcesSelected();
    ben.sourceOfInformation = sources ? sources.join(',') : undefined;
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
          this.notify.alert(this.lang.t('DetailsUpdatedSuccessfully'), 'success');
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
