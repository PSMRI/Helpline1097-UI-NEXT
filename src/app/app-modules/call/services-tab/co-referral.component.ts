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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardSelectImports } from '@common-ui/ui/select';

import { BeneficiaryApiService } from '@/app-modules/core/services/beneficiary-api.service';
import { CoServicesApiService } from '@/app-modules/core/services/co-services-api.service';
import { LocationApiService } from '@/app-modules/core/services/location-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import {
  DistrictRow,
  InstituteDirectory,
  InstituteSubDirectory,
  RegistrationData,
  TalukRow,
} from '@/app-modules/core/models';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Referral service tab (old `co-referral-services`). State→District→Taluk cascade +
 * Directory→Sub-Directory, then "Provide Referral" SAVES the mapping (old "Get Details")
 * and refreshes history. The old post-save institution-list SMS flow (types→templates→send
 * + alternate-number dialog) is deferred within Phase 6 — flagged, not demo-critical.
 */
@Component({
  selector: 'app-co-referral',
  imports: [ReactiveFormsModule, ZardButtonComponent, ...ZardSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <form [formGroup]="form" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label class="flex flex-col gap-1.5 text-sm">
          <span>State <span class="text-destructive">*</span></span>
          <z-select formControlName="state" zPlaceholder="Select state" (zValueChange)="onStateChange()">
            @for (s of states(); track s.stateID) {
              <z-select-item [zValue]="s.stateID + ''">{{ s.stateName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>District <span class="text-destructive">*</span></span>
          <z-select formControlName="district" zPlaceholder="Select district" (zValueChange)="onDistrictChange()">
            @for (d of districts(); track d.districtID) {
              <z-select-item [zValue]="d.districtID + ''">{{ d.districtName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Taluk</span>
          <z-select formControlName="taluk" zPlaceholder="Select taluk">
            @for (t of taluks(); track t.talukID) {
              <z-select-item [zValue]="t.talukID + ''">{{ t.talukName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Directory <span class="text-destructive">*</span></span>
          <z-select formControlName="directory" zPlaceholder="Select directory" (zValueChange)="onDirectoryChange()">
            @for (d of directories(); track d.instituteDirectoryID) {
              <z-select-item [zValue]="d.instituteDirectoryID + ''">{{ d.instituteDirectoryName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Sub-Directory <span class="text-destructive">*</span></span>
          <z-select formControlName="subDirectory" zPlaceholder="Select sub-directory">
            @for (s of subDirectories(); track s.instituteSubDirectoryID) {
              <z-select-item [zValue]="s.instituteSubDirectoryID + ''">{{ s.instituteSubDirectoryName }}</z-select-item>
            }
          </z-select>
        </label>
        <div class="flex items-end">
          <button z-button type="button" [zDisabled]="form.invalid" [zLoading]="saving()" (click)="provideReferral()">
            Provide Referral
          </button>
        </div>
      </form>

      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-3 py-2">Institution</th>
              <th class="px-3 py-2">By</th>
              <th class="px-3 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            @for (h of history(); track $index) {
              <tr class="border-t border-border">
                <td class="px-3 py-2">
                  {{ h.instituteDirectoryMapping?.institutionDetails?.institutionName }}
                </td>
                <td class="px-3 py-2">{{ h.createdBy }}</td>
                <td class="px-3 py-2">{{ h.createdDate }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="3" class="px-3 py-4 text-center text-muted-foreground">
                  No referral services recorded yet.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class CoReferralComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CoServicesApiService);
  private readonly locationApi = inject(LocationApiService);
  private readonly beneficiaryApi = inject(BeneficiaryApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);

  readonly serviceProvided = output<void>();

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  private readonly subServiceId = signal<number | null>(null);

  protected readonly states = signal<RegistrationData['states']>([]);
  protected readonly districts = signal<DistrictRow[]>([]);
  protected readonly taluks = signal<TalukRow[]>([]);
  protected readonly directories = signal<InstituteDirectory[]>([]);
  protected readonly subDirectories = signal<InstituteSubDirectory[]>([]);
  protected readonly history = signal<
    { instituteDirectoryMapping?: { institutionDetails?: { institutionName?: string } }; createdBy?: string; createdDate?: string }[]
  >([]);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    state: this.fb.control<string | null>(null),
    district: this.fb.control<string | null>(null),
    taluk: this.fb.control<string | null>(null),
    directory: this.fb.control<string | null>(null),
    subDirectory: this.fb.control<string | null>(null),
  });

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.beneficiaryApi.getRegistrationData(serviceId).subscribe({
      next: (res) => this.states.set(res?.data?.states ?? []),
      error: () => this.states.set([]),
    });
    this.locationApi.getDirectories(serviceId).subscribe({
      next: (res) => this.directories.set(res?.data?.directory ?? []),
      error: () => this.directories.set([]),
    });
    this.api.getServiceTypes(serviceId).subscribe({
      next: (res) => {
        const match = (res?.data ?? []).find((t) => t.subServiceName?.toUpperCase().includes('REFE'));
        this.subServiceId.set(match?.subServiceID ?? null);
      },
      error: () => this.subServiceId.set(null),
    });
    this.loadHistory();
  }

  protected onStateChange(): void {
    this.districts.set([]);
    this.taluks.set([]);
    this.form.patchValue({ district: null, taluk: null });
    const state = this.form.controls.state.value;
    if (!state) {
      return;
    }
    this.locationApi.getDistricts(state).subscribe({
      next: (res) => this.districts.set(res?.data ?? []),
      error: () => this.districts.set([]),
    });
  }

  protected onDistrictChange(): void {
    this.taluks.set([]);
    this.form.patchValue({ taluk: null });
    const district = this.form.controls.district.value;
    if (!district) {
      return;
    }
    this.locationApi.getTaluks(district).subscribe({
      next: (res) => this.taluks.set(res?.data ?? []),
      error: () => this.taluks.set([]),
    });
  }

  protected onDirectoryChange(): void {
    this.subDirectories.set([]);
    this.form.patchValue({ subDirectory: null });
    const directory = this.form.controls.directory.value;
    if (!directory) {
      return;
    }
    this.locationApi.getSubDirectories(directory).subscribe({
      next: (res) => this.subDirectories.set(res?.data?.subDirectory ?? []),
      error: () => this.subDirectories.set([]),
    });
  }

  protected provideReferral(): void {
    const v = this.form.getRawValue();
    if (!v.state || !v.district || !v.directory || !v.subDirectory) {
      return;
    }
    const num = (s: string | null) => (s ? Number(s) : null);
    this.saving.set(true);
    this.api
      .saveReferralMapping({
        beneficiaryRegID: this.callStore.beneficiaryRegId(),
        benCallID: this.callStore.benCallID(),
        subServiceID: this.subServiceId(),
        createdBy: this.sessionStore.user()?.userName,
        instituteDirectoryID: num(v.directory),
        instituteSubDirectoryID: num(v.subDirectory),
        stateID: num(v.state),
        districtID: num(v.district),
        blockID: num(v.taluk),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notify.alert('Referral recorded', 'success');
          this.serviceProvided.emit();
          this.loadHistory();
        },
        error: (err: { errorMessage?: string }) => {
          this.saving.set(false);
          this.notify.alert(err?.errorMessage ?? 'Failed to save referral', 'error');
        },
      });
  }

  private loadHistory(): void {
    const regId = this.callStore.beneficiaryRegId();
    const serviceId = this.serviceId();
    if (regId == null || serviceId == null) {
      return;
    }
    this.api.getReferralHistory(regId, serviceId).subscribe({
      next: (res) => this.history.set(Array.isArray(res?.data) ? res.data : []),
      error: () => this.history.set([]),
    });
  }
}
