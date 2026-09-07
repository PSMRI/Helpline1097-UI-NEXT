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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { cardImports } from '@common-ui/ui/card';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { BeneficiaryApiService } from '@/app-modules/core/services/beneficiary-api.service';
import { CallApiService } from '@/app-modules/core/services/call-api.service';
import { LocationApiService } from '@/app-modules/core/services/location-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SmsApiService } from '@/app-modules/core/services/sms-api.service';
import {
  BeneficiaryRecord,
  BenPhoneMap,
  DistrictRow,
  RegistrationData,
  TalukRow,
  VillageRow,
} from '@/app-modules/core/models';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { numOrNull } from '@/app-modules/core/utils/select-value';
import { buildStartCallRequest, captureStartCallResponse } from '../start-call.helpers';

/**
 * Beneficiary registration — wizard slide 0 (old `beneficiary-registration`, ~1827 lines).
 * Faithful port of the INBOUND core: CLI auto-search on load, search by beneficiary id,
 * a results table (select → link the beneficiary to the call and advance the wizard), and a
 * register-new form that creates a beneficiary then links it. `startCall` fires once on load
 * (old `setUniqueCallIDForInBound` guard) so `benCallID` exists for the closeCall/service
 * saves. Location is a state→district→taluk→village cascade.
 *
 * Deferred within Phase 6 (flagged in the plan, not demo-critical): the advanced-search
 * form, edit/update mode, the DOB↔age tri-directional auto-sync, and the post-create SMS
 * dialog. The old `govtIdentityTypeID`-hardcoded-to-1 quirk is intentionally NOT replicated
 * (the field is not captured here).
 */
@Component({
  selector: 'app-beneficiary-registration',
  imports: [
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardInputDirective,
    NgIcon,
    ...ZardSelectImports,
    ...cardImports,
  ],
  viewProviders: [provideIcons({ lucideX })],
  templateUrl: './beneficiary-registration.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeneficiaryRegistrationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly beneficiaryApi = inject(BeneficiaryApiService);
  private readonly callApi = inject(CallApiService);
  private readonly locationApi = inject(LocationApiService);
  private readonly notify = inject(NotificationService);
  private readonly smsApi = inject(SmsApiService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);

  /** Emitted once a beneficiary is selected/registered — the wizard advances (old `benService`). */
  readonly beneficiarySelected = output<void>();

  private readonly providerServiceMapId = computed(() => this.sessionStore.currentServiceId());

  /** Old `vanID` = the service master id (previlegeObj[0].roles[0]...m_ServiceMaster.serviceID). */
  private readonly vanId = computed(
    () =>
      this.sessionStore.privileges()?.[0]?.roles?.[0]?.serviceRoleScreenMappings?.[0]
        ?.providerServiceMapping?.m_ServiceMaster?.serviceID ?? null,
  );

  // View state
  protected readonly mode = signal<'search' | 'register'>('search');
  /** When set, the register form is editing this existing beneficiary (old edit/update mode). */
  protected readonly editingRecord = signal<BeneficiaryRecord | null>(null);
  /**
   * True while an edit-load is populating the form. It suppresses the age↔DOB sync so the
   * z-selects/inputs firing on programmatic value-set can't recompute (and overwrite) the
   * loaded DOB from age against today's date. Cleared on the first real user focus in the form.
   */
  private editLoading = false;
  protected readonly results = signal<BeneficiaryRecord[]>([]);
  /** Client-side pagination for the search-results list (old md2Data rowsPerPage). */
  protected readonly pageSize = 5;
  protected readonly pageIndex = signal(0);
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.results().length / this.pageSize)),
  );
  protected readonly pagedResults = computed(() =>
    this.results().slice(this.pageIndex() * this.pageSize, (this.pageIndex() + 1) * this.pageSize),
  );
  /** Old `ParentBenRegID`: the family head on the calling number, taken from the first CLI
   * search result — a new registration on that number joins the family via this id. */
  private readonly parentBenRegID = signal<number | string | null>(null);
  protected readonly searching = signal(false);
  protected readonly submitting = signal(false);
  /**
   * True while the inbound `call/startCall` is in flight. Selecting/creating a beneficiary
   * in that window would post `updatebeneficiaryincall` with a null benCallID and orphan the
   * linkage, so the Select/Register actions wait for it. Deliberately NOT gated on
   * benCallID existing: if startCall fails the old app carried on (error swallowed), and
   * locking the whole call behind a failed request would be a behaviour change.
   */
  protected readonly startCallPending = signal(false);

  // Master data (from getRegistrationDataV1)
  protected readonly titles = signal<RegistrationData['m_Title']>([]);
  protected readonly genders = signal<RegistrationData['m_genders']>([]);
  protected readonly maritalStatuses = signal<RegistrationData['m_maritalStatuses']>([]);
  protected readonly communities = signal<RegistrationData['m_communities']>([]);
  protected readonly languages = signal<RegistrationData['m_language']>([]);
  protected readonly relationships = signal<RegistrationData['benRelationshipTypes']>([]);
  protected readonly states = signal<RegistrationData['states']>([]);
  protected readonly districts = signal<DistrictRow[]>([]);
  protected readonly taluks = signal<TalukRow[]>([]);
  protected readonly villages = signal<VillageRow[]>([]);
  protected readonly ageUnits = ['Years', 'Months', 'Days'];

  /** Advanced-search panel (old `isAdvancedSearch`) + its own location cascade. */
  protected readonly advancedMode = signal(false);
  protected readonly advDistricts = signal<DistrictRow[]>([]);
  protected readonly advTaluks = signal<TalukRow[]>([]);

  /** Search-by-id control. */
  protected readonly searchId = this.fb.control('', { nonNullable: true });

  /** Old advanced-search form (posted to beneficiary/searchBeneficiary). */
  protected readonly advForm = this.fb.group({
    firstName: this.fb.control('', Validators.required),
    lastName: this.fb.control(''),
    fatherName: this.fb.control(''),
    genderID: this.fb.control<string | null>(null, Validators.required),
    state: this.fb.control<string | null>(null, Validators.required),
    district: this.fb.control<string | null>(null, Validators.required),
    taluk: this.fb.control<string | null>(null),
  });

  // Form control values are strings (z-select emits strings); ID fields are coerced back to
  // numbers when the create payload is built.
  protected readonly form = this.fb.group({
    titleId: this.fb.control<string | null>(null),
    firstName: this.fb.control('', { nonNullable: true }),
    lastName: this.fb.control('', { nonNullable: true }),
    genderID: this.fb.control<string | null>(null, Validators.required),
    dOB: this.fb.control<string | null>(null),
    age: this.fb.control<string | null>(null),
    ageUnit: this.fb.control('Years', { nonNullable: true }),
    maritalStatusID: this.fb.control<string | null>(null),
    community: this.fb.control<string | null>(null),
    beneficiaryRelationID: this.fb.control<string | null>(null),
    state: this.fb.control<string | null>(null, Validators.required),
    district: this.fb.control<string | null>(null, Validators.required),
    taluk: this.fb.control<string | null>(null),
    village: this.fb.control<string | null>(null),
    pincode: this.fb.control('', { validators: [Validators.minLength(6), Validators.maxLength(6)] }),
    alternateNumber1: this.fb.control(''),
    alternateNumber2: this.fb.control(''),
    alternateNumber3: this.fb.control(''),
    alternateNumber4: this.fb.control(''),
    alternateNumber5: this.fb.control(''),
    preferredLanguage: this.fb.control<string | null>(null, Validators.required),
  });

  ngOnInit(): void {
    this.loadRegistrationData();
    // The fork keys on the CAMPAIGN (memory-only, like the old current_campaign — a
    // mid-call reload falls into the inbound path), not the event's call type.
    if (this.callStore.currentCampaign() === 'OUTBOUND') {
      this.startOutboundCall();
      return;
    }
    this.startCall();
    const cli = this.callStore.cli();
    if (cli) {
      this.searchId.setValue('');
      this.searchByPhone(cli);
    }
  }

  private loadRegistrationData(): void {
    const serviceId = this.providerServiceMapId();
    if (serviceId == null) {
      return;
    }
    this.beneficiaryApi.getRegistrationData(serviceId).subscribe({
      next: (res) => {
        const d = res?.data;
        if (!d) {
          return;
        }
        this.titles.set(d.m_Title ?? []);
        this.genders.set(d.m_genders ?? []);
        this.maritalStatuses.set(d.m_maritalStatuses ?? []);
        this.communities.set(d.m_communities ?? []);
        this.languages.set(d.m_language ?? []);
        this.relationships.set(d.benRelationshipTypes ?? []);
        this.states.set(d.states ?? []);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load registration data', 'error'),
    });
  }

  /**
   * Old `startCall`: open the call record once per inbound call (guarded by the call flag
   * being freshly set), storing `benCallID` for the later service/closure saves.
   */
  private startCall(): void {
    if (this.callStore.benCallID() != null) {
      return;
    }
    const request = buildStartCallRequest(this.sessionStore, this.callStore, {
      phoneNo: this.callStore.cli(),
    });
    this.startCallPending.set(true);
    this.callApi.startCall(request).subscribe({
      next: (res) => {
        captureStartCallResponse(res, this.callStore);
        this.startCallPending.set(false);
      },
      error: () => {
        // Old app swallowed startCall errors (the agent can still work the call).
        this.startCallPending.set(false);
      },
    });
  }

  /** Generic outbound (old `startOutBoundCall`+`outboundEvent`): open the call with the
   * worklist row, capture `outBoundCallID`, load the row's beneficiary for selection. */
  private startOutboundCall(): void {
    const row = this.callStore.outboundData() as {
      outboundCallReqID?: number | string;
      beneficiary?: {
        beneficiaryID?: number | string;
        beneficiaryRegID?: number | string;
        benPhoneMaps?: { phoneNo?: string }[];
      };
    } | null;
    if (!row) {
      const benId = this.callStore.outboundBenRegID();
      if (benId != null) {
        this.runSearch(this.beneficiaryApi.searchByBeneficiaryId(String(benId)));
      }
      return;
    }
    if (this.callStore.benCallID() != null) {
      this.searchOutboundBeneficiary(row);
      return;
    }
    const request = buildStartCallRequest(this.sessionStore, this.callStore, {
      phoneNo: row.beneficiary?.benPhoneMaps?.[0]?.phoneNo ?? null,
      beneficiaryRegID: row.beneficiary?.beneficiaryRegID ?? null,
    });
    this.startCallPending.set(true);
    this.callApi.startCall(request).subscribe({
      next: (res) => {
        captureStartCallResponse(res, this.callStore);
        this.startCallPending.set(false);
        this.callStore.outBoundCallID.set(row.outboundCallReqID ?? null);
        this.searchOutboundBeneficiary(row);
      },
      error: (err: { errorMessage?: string }) => {
        this.startCallPending.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to start call', 'error');
      },
    });
  }

  private searchOutboundBeneficiary(row: {
    beneficiary?: { beneficiaryID?: number | string };
  }): void {
    const beneficiaryId = row.beneficiary?.beneficiaryID;
    if (beneficiaryId != null) {
      this.runSearch(this.beneficiaryApi.searchByBeneficiaryId(String(beneficiaryId)));
    }
  }

  protected search(): void {
    const id = this.searchId.value.trim();
    if (id) {
      this.runSearch(this.beneficiaryApi.searchByBeneficiaryId(id));
    } else {
      this.retrieveAll();
    }
  }

  /** Old "Retrieve All" — re-run the CLI search (still used by the empty-id search + CLI auto-load). */
  protected retrieveAll(): void {
    const cli = this.callStore.cli();
    if (cli) {
      this.searchByPhone(cli);
    }
  }

  /** Clear-icon (×) on the beneficiary-id search input. */
  protected clearSearchId(): void {
    this.searchId.setValue('');
  }

  private searchByPhone(phone: string): void {
    this.runSearch(this.beneficiaryApi.searchByPhone(phone));
  }

  private runSearch(source: ReturnType<BeneficiaryApiService['searchByPhone']>): void {
    this.searching.set(true);
    source.subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.data) ? res.data : [];
        this.results.set(rows);
        this.pageIndex.set(0);
        this.parentBenRegID.set(rows[0]?.benPhoneMaps?.[0]?.parentBenRegID ?? null);
        this.searching.set(false);
      },
      error: (err: { errorMessage?: string }) => {
        this.searching.set(false);
        this.notify.alert(err?.errorMessage ?? 'Search failed', 'error');
      },
    });
  }

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }

  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  protected toggleAdvanced(): void {
    this.advancedMode.update((v) => !v);
  }

  protected advClear(): void {
    this.advForm.reset();
    this.advDistricts.set([]);
    this.advTaluks.set([]);
  }

  protected advOnStateChange(value: string | string[]): void {
    this.advDistricts.set([]);
    this.advTaluks.set([]);
    this.advForm.patchValue({ district: null, taluk: null });
    const state = numOrNull(value as string);
    if (state == null) {
      return;
    }
    this.locationApi.getDistricts(state).subscribe({
      next: (res) => this.advDistricts.set(res?.data ?? []),
      error: () => this.advDistricts.set([]),
    });
  }

  protected advOnDistrictChange(value: string | string[]): void {
    this.advTaluks.set([]);
    this.advForm.patchValue({ taluk: null });
    const district = numOrNull(value as string);
    if (district == null) {
      return;
    }
    this.locationApi.getTaluks(district).subscribe({
      next: (res) => this.advTaluks.set(res?.data ?? []),
      error: () => this.advTaluks.set([]),
    });
  }

  /** Old `searchBeneficiary` — post the advanced-search criteria and show the matches. */
  protected runAdvancedSearch(): void {
    const v = this.advForm.getRawValue();
    this.runSearch(
      this.beneficiaryApi.advancedSearch({
        firstName: v.firstName || undefined,
        lastName: v.lastName || undefined,
        fatherName: v.fatherName || undefined,
        genderID: numOrNull(v.genderID),
        stateID: numOrNull(v.state),
        districtID: numOrNull(v.district),
        blockID: numOrNull(v.taluk),
      }),
    );
  }

  /** Row select → link the beneficiary to the open call, then advance the wizard. */
  protected selectBeneficiary(beneficiary: BeneficiaryRecord): void {
    this.linkBeneficiaryToCall(beneficiary);
  }

  /** Old edit action (row `mode_edit`) — load the beneficiary into the register form to update it. */
  protected editBeneficiary(beneficiary: BeneficiaryRecord): void {
    this.editLoading = true;
    this.editingRecord.set(beneficiary);
    this.mode.set('register');
    const demo = beneficiary.i_bendemographics ?? {};
    // Phone maps: [0] is the primary (the CLI); [1..5] are the alternates.
    const alts = (beneficiary.benPhoneMaps ?? []).slice(1).map((p) => p.phoneNo ?? '');
    this.form.reset({ ageUnit: beneficiary.ageUnits || 'Years' });
    this.form.patchValue({
      titleId: beneficiary.titleId != null ? String(beneficiary.titleId) : null,
      firstName: beneficiary.firstName ?? '',
      lastName: beneficiary.lastName ?? '',
      genderID: beneficiary.genderID != null ? String(beneficiary.genderID) : null,
      dOB: beneficiary.dOB ? beneficiary.dOB.slice(0, 10) : null,
      age: beneficiary.actualAge != null ? String(beneficiary.actualAge) : null,
      maritalStatusID: beneficiary.maritalStatusID != null ? String(beneficiary.maritalStatusID) : null,
      community: demo.communityID != null ? String(demo.communityID) : null,
      state: demo.stateID != null ? String(demo.stateID) : null,
      district: demo.districtID != null ? String(demo.districtID) : null,
      taluk: demo.blockID != null ? String(demo.blockID) : null,
      village: demo.districtBranchID != null ? String(demo.districtBranchID) : null,
      pincode: demo.pinCode ?? '',
      preferredLanguage: demo.preferredLangID != null ? String(demo.preferredLangID) : null,
      alternateNumber1: alts[0] ?? '',
      alternateNumber2: alts[1] ?? '',
      alternateNumber3: alts[2] ?? '',
      alternateNumber4: alts[3] ?? '',
      alternateNumber5: alts[4] ?? '',
    });
    // Load the dependent dropdowns so the pre-filled state/district/taluk resolve to labels.
    if (demo.stateID != null) {
      this.locationApi.getDistricts(demo.stateID).subscribe({
        next: (res) => this.districts.set(res?.data ?? []),
        error: () => this.districts.set([]),
      });
    }
    if (demo.districtID != null) {
      this.locationApi.getTaluks(demo.districtID).subscribe({
        next: (res) => this.taluks.set(res?.data ?? []),
        error: () => this.taluks.set([]),
      });
    }
    if (demo.blockID != null) {
      this.locationApi.getVillages(demo.blockID).subscribe({
        next: (res) => this.villages.set(res?.data ?? []),
        error: () => this.villages.set([]),
      });
    }
  }

  private linkBeneficiaryToCall(beneficiary: BeneficiaryRecord): void {
    // Store the beneficiary + derive the authoritative registration id (handles create's
    // top-level id and the various search-result shapes).
    this.callStore.setBeneficiary(beneficiary as Record<string, unknown>);
    const regId = this.callStore.beneficiaryRegId();
    // Old `updatebeneficiaryincall`: POST the FULL startCall callData with beneficiaryRegID
    // patched in (the old app sent the whole object, not a minimal body). The old code also
    // patched `isCalledEarlier` from the called-earlier radio — that radio is a deferred
    // registration sub-part, so the response's own value is kept meanwhile.
    this.callApi
      .updateBeneficiaryInCall({
        ...(this.callStore.callData() ?? { benCallID: this.callStore.benCallID() }),
        beneficiaryRegID: regId,
      })
      .subscribe({
        next: () => this.beneficiarySelected.emit(),
        // Faithful: the old app still advanced on link failure (the call continues).
        error: () => this.beneficiarySelected.emit(),
      });
  }

  protected toggleMode(): void {
    // Fresh (non-edit) register: the age↔DOB sync must be live from the start.
    this.editLoading = false;
    if (this.mode() === 'register') {
      this.mode.set('search');
      this.editingRecord.set(null);
      this.form.reset({ ageUnit: 'Years' });
    } else {
      this.editingRecord.set(null);
      this.form.reset({ ageUnit: 'Years' });
      this.mode.set('register');
    }
  }

  /**
   * First real user interaction with the register form releases the edit-load guard, so the
   * age↔DOB sync resumes for genuine edits (the programmatic edit-load has settled by then).
   */
  protected onFormInteract(): void {
    this.editLoading = false;
  }

  // Handlers take the emitted value: z-select fires zValueChange BEFORE its CVA writes the
  // form control, so reading the control here would see the previous selection.
  protected onStateChange(value: string | string[]): void {
    this.districts.set([]);
    this.taluks.set([]);
    this.villages.set([]);
    this.form.patchValue({ district: null, taluk: null, village: null });
    const state = numOrNull(value as string);
    if (state == null) {
      return;
    }
    this.locationApi.getDistricts(state).subscribe({
      next: (res) => this.districts.set(res?.data ?? []),
      error: () => this.districts.set([]),
    });
  }

  protected onDistrictChange(value: string | string[]): void {
    this.taluks.set([]);
    this.villages.set([]);
    this.form.patchValue({ taluk: null, village: null });
    const district = numOrNull(value as string);
    if (district == null) {
      return;
    }
    this.locationApi.getTaluks(district).subscribe({
      next: (res) => this.taluks.set(res?.data ?? []),
      error: () => this.taluks.set([]),
    });
  }

  protected onTalukChange(value: string | string[]): void {
    this.villages.set([]);
    this.form.patchValue({ village: null });
    const taluk = numOrNull(value as string);
    if (taluk == null) {
      return;
    }
    this.locationApi.getVillages(taluk).subscribe({
      next: (res) => this.villages.set(res?.data ?? []),
      error: () => this.villages.set([]),
    });
  }

  /**
   * Old `onAgeEntered` / `onAgeUnitEntered`: DOB = today minus the entered age in the chosen
   * unit (Years capped at 120). `emitEvent:false` so it doesn't feed back into the DOB→age sync.
   */
  protected onAgeChange(): void {
    // Edit-load populates age + DOB together; the ageUnit z-select emits zValueChange on that
    // programmatic set and would otherwise recompute (and corrupt) the loaded DOB from age
    // against today. Suppress until the user actually interacts with the form.
    if (this.editLoading) {
      return;
    }
    const raw = this.form.controls.age.value;
    const unit = this.form.controls.ageUnit.value;
    if (raw == null || raw === '') {
      this.form.patchValue({ dOB: null }, { emitEvent: false });
      return;
    }
    const age = Number(raw);
    if (isNaN(age) || age < 0) {
      return;
    }
    if (unit === 'Years' && age > 120) {
      this.form.patchValue({ age: null }, { emitEvent: false });
      return;
    }
    const d = new Date();
    if (unit === 'Months') {
      d.setMonth(d.getMonth() - age);
    } else if (unit === 'Days') {
      d.setDate(d.getDate() - age);
    } else {
      d.setFullYear(d.getFullYear() - age);
    }
    this.form.patchValue({ dOB: this.toDateInput(d) }, { emitEvent: false });
  }

  /**
   * Old `dobChangeByCalender`: derive age + unit from DOB — whole years if ≥1, else months,
   * else days (a same-day DOB becomes 1 Day).
   */
  protected onDobChange(): void {
    if (this.editLoading) {
      return;
    }
    const dobStr = this.form.controls.dOB.value;
    if (!dobStr) {
      this.form.patchValue({ age: null }, { emitEvent: false });
      return;
    }
    const dob = new Date(dobStr);
    const today = new Date();
    let years = today.getFullYear() - dob.getFullYear();
    const monthDelta = today.getMonth() - dob.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
      years--;
    }
    if (years > 0) {
      this.form.patchValue({ age: String(years), ageUnit: 'Years' }, { emitEvent: false });
      return;
    }
    let months = monthDelta + 12 * (today.getFullYear() - dob.getFullYear());
    if (today.getDate() < dob.getDate()) {
      months--;
    }
    if (months > 0) {
      this.form.patchValue({ age: String(months), ageUnit: 'Months' }, { emitEvent: false });
      return;
    }
    const days = Math.max(1, Math.floor((today.getTime() - dob.getTime()) / 86400000));
    this.form.patchValue({ age: String(days), ageUnit: 'Days' }, { emitEvent: false });
  }

  private toDateInput(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Old `registerBeneficiary`: build the create payload, persist, then link to the call. */
  protected register(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const userName = this.sessionStore.user()?.userName;
    const relationshipId = numOrNull(v.beneficiaryRelationID);
    // Old app linked every phone map of a new registration to the family head on the number.
    const parentBenRegID = this.parentBenRegID();
    const phoneMaps: BenPhoneMap[] = [
      {
        parentBenRegID,
        benRelationshipID: relationshipId,
        phoneNo: this.callStore.cli() ?? '',
        createdBy: userName,
        deleted: false,
      },
    ];
    // Old app appended up to 5 alternate numbers (each as its own phone map).
    for (const alt of [
      v.alternateNumber1,
      v.alternateNumber2,
      v.alternateNumber3,
      v.alternateNumber4,
      v.alternateNumber5,
    ]) {
      if (alt) {
        phoneMaps.push({
          parentBenRegID,
          benRelationshipID: relationshipId,
          phoneNo: alt,
          createdBy: userName,
          deleted: false,
        });
      }
    }
    const editing = this.editingRecord();
    const beneficiary: BeneficiaryRecord = {
      // Editing preserves the loaded record's other fields (regID, occupation/education, etc.).
      ...(editing ?? {}),
      vanID: this.vanId() ?? undefined,
      providerServiceMapID: this.providerServiceMapId() ?? undefined,
      titleId: numOrNull(v.titleId),
      firstName: v.firstName,
      lastName: v.lastName,
      genderID: numOrNull(v.genderID),
      // Backend deserializes dOB to a timestamp and 500s on a bare date; old app sent
      // `<yyyy-MM-dd>T00:00:00.000Z` (the date input's value is already local yyyy-MM-dd).
      dOB: v.dOB ? `${v.dOB}T00:00:00.000Z` : undefined,
      maritalStatusID: numOrNull(v.maritalStatusID),
      benPhoneMaps: phoneMaps,
      // Old app hardcoded govtIdentityTypeID = 1 and sent an empty govtIdentityNo.
      govtIdentityNo: '',
      govtIdentityTypeID: 1,
      i_bendemographics: {
        ...(editing?.i_bendemographics ?? {}),
        communityID: numOrNull(v.community),
        stateID: numOrNull(v.state),
        districtID: numOrNull(v.district),
        blockID: numOrNull(v.taluk),
        districtBranchID: numOrNull(v.village),
        pinCode: v.pincode || null,
        preferredLangID: numOrNull(v.preferredLanguage),
      },
      statusID: 1,
      createdBy: userName,
      deleted: false,
    };

    this.submitting.set(true);
    if (editing) {
      this.updateExisting(beneficiary, v.age, v.ageUnit);
    } else {
      this.beneficiaryApi.createBeneficiary(beneficiary).subscribe({
        next: (res) => {
          this.submitting.set(false);
          const created = res?.data;
          if (res?.statusCode === 200 && created) {
            this.notify.alert(
              `Beneficiary registered with ID ${created.beneficiaryID ?? ''}`,
              'success',
            );
            // Old post-create dialog offered to text the beneficiary; then the wizard advances.
            this.notify
              .confirm(
                `Beneficiary registered with ID ${created.beneficiaryID ?? ''}. Send a registration SMS?`,
                'Send SMS',
                { okText: 'Send SMS', cancelText: 'Skip' },
              )
              .subscribe((ok) => {
                if (ok) {
                  this.sendRegistrationSms(created.beneficiaryRegID);
                }
                this.linkBeneficiaryToCall(created);
              });
          } else {
            this.notify.alert(res?.errorMessage ?? 'Registration failed', 'error');
          }
        },
        error: (err: { errorMessage?: string }) => {
          this.submitting.set(false);
          this.notify.alert(err?.errorMessage ?? 'Registration failed', 'error');
        },
      });
    }
  }

  /** Old `updateBeneficiary` — whole-object `beneficiary/update` with all change flags set. */
  private updateExisting(beneficiary: BeneficiaryRecord, age: string | null, ageUnit: string): void {
    const payload: BeneficiaryRecord = {
      ...beneficiary,
      actualAge: age != null && age !== '' ? Number(age) : undefined,
      ageUnits: ageUnit,
      changeInSelfDetails: true,
      changeInAddress: true,
      changeInContacts: true,
      changeInIdentities: true,
      changeInOtherDetails: true,
      changeInFamilyDetails: true,
      changeInAssociations: true,
      changeInBankDetails: false,
      changeInBenImage: false,
    };
    this.beneficiaryApi.updateBeneficiary(payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res?.statusCode === 200) {
          this.notify.alert('Beneficiary updated', 'success');
          this.editingRecord.set(null);
          this.linkBeneficiaryToCall(res.data ?? payload);
        } else {
          this.notify.alert(res?.errorMessage ?? 'Update failed', 'error');
        }
      },
      error: (err: { errorMessage?: string }) => {
        this.submitting.set(false);
        this.notify.alert(err?.errorMessage ?? 'Update failed', 'error');
      },
    });
  }

  /**
   * Old `sendSMS` — resolve the "Registration SMS" type, take its first live template, and send.
   * Fire-and-forget so it never blocks the wizard advancing.
   */
  private sendRegistrationSms(beneficiaryRegID?: number | string): void {
    const serviceId = this.providerServiceMapId();
    if (serviceId == null || beneficiaryRegID == null) {
      return;
    }
    // Old `getSMStypes(current_serviceID)` — the SERVICE MASTER id, not the
    // providerServiceMapID (which returns an empty list, so no type would ever match).
    const smsTypeServiceId = this.sessionStore.serviceMasterId();
    if (smsTypeServiceId == null) {
      return;
    }
    const userName = this.sessionStore.user()?.userName;
    this.smsApi.getSmsTypes(smsTypeServiceId).subscribe({
      next: (res) => {
        const smsTypeID = (res?.data ?? []).find(
          (t) => t.smsType?.toLowerCase() === 'registration sms',
        )?.smsTypeID;
        if (smsTypeID == null) {
          return;
        }
        this.smsApi.getSmsTemplates(serviceId, smsTypeID).subscribe({
          next: (tRes) => {
            const smsTemplateID = (tRes?.data ?? []).find((t) => t.deleted === false)?.smsTemplateID;
            this.smsApi
              .sendSms([
                {
                  alternateNo: null,
                  beneficiaryRegID,
                  createdBy: userName,
                  is1097: true,
                  providerServiceMapID: serviceId,
                  smsTemplateID,
                  smsTemplateTypeID: smsTypeID,
                },
              ])
              .subscribe({
                next: () => this.notify.alert('Registration SMS sent', 'success'),
                error: () => this.notify.alert('Registration SMS could not be sent', 'error'),
              });
          },
          error: () => {
            // Old app only logged template-fetch failures.
          },
        });
      },
      error: () => {
        // Old app only logged sms-type-fetch failures.
      },
    });
  }
}
