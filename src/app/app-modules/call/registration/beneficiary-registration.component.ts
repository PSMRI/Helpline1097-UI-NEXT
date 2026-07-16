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

import { ZardButtonComponent } from '@common-ui/ui/button';
import { cardImports } from '@common-ui/ui/card';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { BeneficiaryApiService } from '@/app-modules/core/services/beneficiary-api.service';
import { CallApiService } from '@/app-modules/core/services/call-api.service';
import { LocationApiService } from '@/app-modules/core/services/location-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import {
  BeneficiaryRecord,
  BenPhoneMap,
  DistrictRow,
  RegistrationData,
  StartCallRequest,
  TalukRow,
  VillageRow,
} from '@/app-modules/core/models';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

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
    ...ZardSelectImports,
    ...cardImports,
  ],
  templateUrl: './beneficiary-registration.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeneficiaryRegistrationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly beneficiaryApi = inject(BeneficiaryApiService);
  private readonly callApi = inject(CallApiService);
  private readonly locationApi = inject(LocationApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);

  /** Emitted once a beneficiary is selected/registered — the wizard advances (old `benService`). */
  readonly beneficiarySelected = output<void>();

  private readonly providerServiceMapId = computed(() => this.sessionStore.currentServiceId());

  // View state
  protected readonly mode = signal<'search' | 'register'>('search');
  protected readonly results = signal<BeneficiaryRecord[]>([]);
  protected readonly searching = signal(false);
  protected readonly submitting = signal(false);

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

  /** Search-by-id control. */
  protected readonly searchId = this.fb.control('', { nonNullable: true });

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
    preferredLanguage: this.fb.control<string | null>(null, Validators.required),
  });

  /** z-select values are strings → coerce ID fields to numbers for the backend payload. */
  private num(value: string | null): number | null {
    return value != null && value !== '' ? Number(value) : null;
  }

  ngOnInit(): void {
    this.loadRegistrationData();
    this.startCall();
    // INBOUND: auto-search the caller's number (old `reloadCall`).
    const cli = this.callStore.cli();
    if (this.callStore.callCategory() !== 'OUTBOUND' && cli) {
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
    if (this.callStore.callCategory() === 'OUTBOUND' || this.callStore.benCallID() != null) {
      return;
    }
    const request: StartCallRequest = {
      callID: this.callStore.sessionId(),
      createdBy: this.sessionStore.user()?.userName,
      calledServiceID: this.providerServiceMapId() ?? undefined,
      phoneNo: this.callStore.cli(),
      agentID: this.sessionStore.agentId(),
      callReceivedUserID: this.sessionStore.userId(),
      receivedRoleName: this.sessionStore.currentRole() ?? undefined,
      isOutbound: this.callStore.isOutbound(),
    };
    this.callApi.startCall(request).subscribe({
      next: (res) => {
        if (res?.data?.benCallID != null) {
          this.callStore.benCallID.set(res.data.benCallID);
        }
      },
      error: () => {
        // Old app swallowed startCall errors (the agent can still work the call).
      },
    });
  }

  protected search(): void {
    const id = this.searchId.value.trim();
    if (id) {
      this.runSearch(this.beneficiaryApi.searchByBeneficiaryId(id));
    } else {
      this.retrieveAll();
    }
  }

  /** Old "Retrieve All" — re-run the CLI search. */
  protected retrieveAll(): void {
    const cli = this.callStore.cli();
    if (cli) {
      this.searchByPhone(cli);
    }
  }

  private searchByPhone(phone: string): void {
    this.runSearch(this.beneficiaryApi.searchByPhone(phone));
  }

  private runSearch(source: ReturnType<BeneficiaryApiService['searchByPhone']>): void {
    this.searching.set(true);
    source.subscribe({
      next: (res) => {
        this.results.set(Array.isArray(res?.data) ? res.data : []);
        this.searching.set(false);
      },
      error: (err: { errorMessage?: string }) => {
        this.searching.set(false);
        this.notify.alert(err?.errorMessage ?? 'Search failed', 'error');
      },
    });
  }

  /** Row select → link the beneficiary to the open call, then advance the wizard. */
  protected selectBeneficiary(beneficiary: BeneficiaryRecord): void {
    this.linkBeneficiaryToCall(beneficiary);
  }

  private linkBeneficiaryToCall(beneficiary: BeneficiaryRecord): void {
    // Store the beneficiary + derive the authoritative registration id (handles create's
    // top-level id and the various search-result shapes).
    this.callStore.setBeneficiary(beneficiary as Record<string, unknown>);
    const regId = this.callStore.beneficiaryRegId();
    // Old `updatebeneficiaryincall`: attach the beneficiary to the open call record.
    this.callApi
      .updateBeneficiaryInCall({
        benCallID: this.callStore.benCallID(),
        beneficiaryRegID: regId,
      })
      .subscribe({
        next: () => this.beneficiarySelected.emit(),
        // Faithful: the old app still advanced on link failure (the call continues).
        error: () => this.beneficiarySelected.emit(),
      });
  }

  protected toggleMode(): void {
    this.mode.set(this.mode() === 'search' ? 'register' : 'search');
  }

  protected onStateChange(): void {
    this.districts.set([]);
    this.taluks.set([]);
    this.villages.set([]);
    this.form.patchValue({ district: null, taluk: null, village: null });
    const state = this.num(this.form.controls.state.value);
    if (state == null) {
      return;
    }
    this.locationApi.getDistricts(state).subscribe({
      next: (res) => this.districts.set(res?.data ?? []),
      error: () => this.districts.set([]),
    });
  }

  protected onDistrictChange(): void {
    this.taluks.set([]);
    this.villages.set([]);
    this.form.patchValue({ taluk: null, village: null });
    const district = this.num(this.form.controls.district.value);
    if (district == null) {
      return;
    }
    this.locationApi.getTaluks(district).subscribe({
      next: (res) => this.taluks.set(res?.data ?? []),
      error: () => this.taluks.set([]),
    });
  }

  protected onTalukChange(): void {
    this.villages.set([]);
    this.form.patchValue({ village: null });
    const taluk = this.num(this.form.controls.taluk.value);
    if (taluk == null) {
      return;
    }
    this.locationApi.getVillages(taluk).subscribe({
      next: (res) => this.villages.set(res?.data ?? []),
      error: () => this.villages.set([]),
    });
  }

  /** Old `registerBeneficiary`: build the create payload, persist, then link to the call. */
  protected register(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const userName = this.sessionStore.user()?.userName;
    const relationshipId = this.num(v.beneficiaryRelationID);
    const phoneMaps: BenPhoneMap[] = [
      {
        parentBenRegID: null,
        benRelationshipID: relationshipId,
        phoneNo: this.callStore.cli() ?? '',
        createdBy: userName,
        deleted: false,
      },
    ];
    if (v.alternateNumber1) {
      phoneMaps.push({
        parentBenRegID: null,
        benRelationshipID: relationshipId,
        phoneNo: v.alternateNumber1,
        createdBy: userName,
        deleted: false,
      });
    }
    const beneficiary: BeneficiaryRecord = {
      providerServiceMapID: this.providerServiceMapId() ?? undefined,
      titleId: this.num(v.titleId),
      firstName: v.firstName,
      lastName: v.lastName,
      genderID: this.num(v.genderID),
      dOB: v.dOB ?? undefined,
      maritalStatusID: this.num(v.maritalStatusID),
      benPhoneMaps: phoneMaps,
      i_bendemographics: {
        communityID: this.num(v.community),
        stateID: this.num(v.state),
        districtID: this.num(v.district),
        blockID: this.num(v.taluk),
        districtBranchID: this.num(v.village),
        pinCode: v.pincode || null,
        preferredLangID: this.num(v.preferredLanguage),
      },
      statusID: 1,
      createdBy: userName,
      deleted: false,
    };

    this.submitting.set(true);
    this.beneficiaryApi.createBeneficiary(beneficiary).subscribe({
      next: (res) => {
        this.submitting.set(false);
        const created = res?.data;
        if (res?.statusCode === 200 && created) {
          this.notify.alert(
            `Beneficiary registered with ID ${created.beneficiaryID ?? ''}`,
            'success',
          );
          this.linkBeneficiaryToCall(created);
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
