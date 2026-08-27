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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardDialogService } from '@common-ui/ui/dialog';
import { ZardSelectImports } from '@common-ui/ui/select';

import { SmsAlternateNumberDialogComponent } from './sms-alternate-number-dialog.component';
import { CoServicesApiService } from '@/app-modules/core/services/co-services-api.service';
import { LocationApiService } from '@/app-modules/core/services/location-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SmsApiService } from '@/app-modules/core/services/sms-api.service';
import {
  DistrictRow,
  InstituteDirectory,
  InstituteSubDirectory,
  InstitutionDetails,
  ReferralInstitutionRow,
  RegistrationData,
  SendSmsRequest,
  SubServiceType,
  TalukRow,
} from '@/app-modules/core/models';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { numOrNull } from '@/app-modules/core/utils/select-value';

/**
 * Referral service tab (old `co-referral-services`). State→District→Taluk cascade +
 * Directory→Sub-Directory, then "Get Details" saves the mapping and renders the institutions
 * the backend matched, each tickable for the referral SMS (types→templates→send, with an
 * optional alternate number). History refreshes after every save.
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
          <span>Directory <span class="text-destructive">*</span></span>
          <z-select formControlName="directory" zPlaceholder="Select directory" (zValueChange)="onDirectoryChange($event)">
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
            Get Details
          </button>
        </div>
      </form>

      <!-- Matched institutions (old post-save result list): tick the ones to SMS -->
      @if (showResult()) {
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium">Matched Institutions</span>
          <div class="max-h-40 overflow-y-auto rounded-md border border-border p-2 text-sm">
            @for (row of institutions(); track $index) {
              @if (row.institutionDetails) {
                <label class="flex items-start gap-2 py-0.5">
                  <input
                    type="checkbox"
                    class="mt-1"
                    [checked]="isSelected($index)"
                    (change)="toggleSms($event, $index)"
                  />
                  <span>{{ institutionLine(row.institutionDetails) }}</span>
                </label>
              }
            } @empty {
              <div class="py-2 text-center text-muted-foreground">No records</div>
            }
          </div>
          <div class="flex justify-start">
            <button
              z-button
              type="button"
              [zDisabled]="selectedRows().length === 0"
              [zLoading]="sendingSms()"
              (click)="openSmsDialog()"
            >
              Send SMS
            </button>
          </div>
        </div>
      }

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
  private readonly smsApi = inject(SmsApiService);
  private readonly dialog = inject(ZardDialogService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);

  /** Shared masters fetched ONCE by the co-services host. */
  readonly serviceTypes = input<SubServiceType[]>([]);
  readonly states = input<RegistrationData['states']>([]);
  readonly serviceProvided = output<void>();

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  // Old app defaulted subServiceID to 3 and only overrode it on a "REFE" name match, so a
  // missing REFE entry still sent 3 (not null).
  private readonly subServiceId = computed(
    () =>
      this.serviceTypes().find((t) => t.subServiceName?.toUpperCase().includes('REFE'))
        ?.subServiceID ?? 3,
  );

  protected readonly districts = signal<DistrictRow[]>([]);
  protected readonly taluks = signal<TalukRow[]>([]);
  protected readonly directories = signal<InstituteDirectory[]>([]);
  protected readonly subDirectories = signal<InstituteSubDirectory[]>([]);
  protected readonly history = signal<
    { instituteDirectoryMapping?: { institutionDetails?: { institutionName?: string } }; createdBy?: string; createdDate?: string }[]
  >([]);
  protected readonly saving = signal(false);
  /** Institutions returned by the last "Get Details" (old `detailsList`). */
  protected readonly institutions = signal<ReferralInstitutionRow[]>([]);
  /** Old `showresult` — the result panel appears only after a Get Details round-trip. */
  protected readonly showResult = signal(false);
  /**
   * Ticked ROW indexes, in tick order (old `ref_array`/`row_array`). Keyed by row rather than
   * by `institutionID` so duplicate ids behave like the old per-row checkboxes.
   */
  protected readonly selectedRows = signal<number[]>([]);
  protected readonly sendingSms = signal(false);

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
    // states + sub-service id come from the host's shared fetch (inputs above).
    this.locationApi.getDirectories(serviceId).subscribe({
      next: (res) => this.directories.set(res?.data?.directory ?? []),
      error: () => this.directories.set([]),
    });
    this.loadHistory();
  }

  // Handlers take the emitted value: z-select fires zValueChange BEFORE its CVA writes the
  // form control, so reading the control here would see the previous selection.
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

  protected onDirectoryChange(value: string | string[]): void {
    this.subDirectories.set([]);
    this.form.patchValue({ subDirectory: null });
    const directory = value as string;
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
    this.saving.set(true);
    this.api
      .saveReferralMapping({
        beneficiaryRegID: this.callStore.beneficiaryRegId(),
        benCallID: this.callStore.benCallID(),
        subServiceID: this.subServiceId(),
        createdBy: this.sessionStore.user()?.userName,
        instituteDirectoryID: numOrNull(v.directory),
        instituteSubDirectoryID: numOrNull(v.subDirectory),
        stateID: numOrNull(v.state),
        districtID: numOrNull(v.district),
        blockID: numOrNull(v.taluk),
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          // Old `SetReferralDetails`: the response IS the matched institution list. It is shown
          // as a tickable list for the referral SMS; an empty list only alerts "No data found".
          const rows = Array.isArray(res?.data) ? (res.data as ReferralInstitutionRow[]) : [];
          this.institutions.set(rows);
          // DELIBERATE DEVIATION from an old-app bug: the old app never cleared its ticked-id
          // list when a new search returned, so a later Send SMS could post institutions from a
          // previous query whose checkboxes rendered unticked.
          this.selectedRows.set([]);
          this.showResult.set(true);
          if (rows.length === 0) {
            this.notify.alert('No data found', 'info');
          }
          this.serviceProvided.emit();
          this.loadHistory();
        },
        error: (err: { errorMessage?: string }) => {
          this.saving.set(false);
          this.notify.alert(err?.errorMessage ?? 'Failed to save referral', 'error');
        },
      });
  }

  // ---- institution result list + referral SMS -------------------------------
  protected isSelected(index: number): boolean {
    return this.selectedRows().includes(index);
  }

  /** Old `toggleSms` — tick/untick keeps the row (institution id + state/district/block). */
  protected toggleSms(event: Event, index: number): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedRows.update((rows) =>
      checked ? [...rows, index] : rows.filter((i) => i !== index),
    );
  }

  /** The ticked institutions, in tick order. */
  private selectedInstitutionDetails(): InstitutionDetails[] {
    const rows = this.institutions();
    return this.selectedRows()
      .map((i) => rows[i]?.institutionDetails)
      .filter((i): i is InstitutionDetails => i != null);
  }

  /**
   * Old result row: the institution name followed by whichever optional fields are present,
   * each comma-separated, in the old template's order.
   */
  protected institutionLine(institution: InstitutionDetails): string {
    const parts = [
      institution.institutionName,
      institution.address,
      institution.website,
      institution.contactPerson1,
      institution.contactNo1,
      institution.contactPerson1Email,
      institution.contactPerson2,
      institution.contactNo2,
      institution.contactPerson2Email,
      institution.contactPerson3,
      institution.contactNo3,
      institution.contactPerson3Email,
    ];
    return parts.filter((p) => p != null && p !== '').join(', ');
  }

  /** Old `sendSMS()` — ask for an optional alternate number, then run the send pipeline. */
  protected openSmsDialog(): void {
    if (this.selectedRows().length === 0) {
      return;
    }
    this.dialog.create<SmsAlternateNumberDialogComponent, unknown>({
      zTitle: 'Send SMS',
      zContent: SmsAlternateNumberDialogComponent,
      zOkText: 'Send SMS',
      zCancelText: 'Close',
      zWidth: '420px',
      zOnOk: (instance) => {
        // Keep the dialog open while an alternate number is incomplete (old app disabled the
        // button); `undefined` here is the faithful "send to primary number" branch.
        if (!instance.canSend()) {
          instance.touched.set(true);
          return false;
        }
        this.sendReferralSms(instance.alternateNumber());
        return undefined;
      },
    });
  }

  /**
   * Old `send_sms`: resolve the "Referral SMS" type, take the first non-deleted template, then
   * post one `sms/sendSMS` item per ticked institution. Every step failing silently matches the
   * old empty error callbacks; only the success toast is shown.
   */
  private sendReferralSms(alternateNo: string | undefined): void {
    const serviceId = this.serviceId();
    const institutions = this.selectedInstitutionDetails();
    if (serviceId == null || institutions.length === 0) {
      return;
    }
    this.sendingSms.set(true);
    this.smsApi.getSmsTypes(serviceId).subscribe({
      next: (typesRes) => {
        const smsType = (typesRes?.data ?? []).find(
          (t) => (t.smsType ?? '').toLowerCase() === 'referral sms',
        );
        const smsTypeID = smsType?.smsTypeID;
        if (smsTypeID == null) {
          this.sendingSms.set(false);
          return;
        }
        this.smsApi.getSmsTemplates(serviceId, smsTypeID).subscribe({
          next: (templatesRes) => {
            const templates = templatesRes?.data;
            // The old SMS service threw when the response carried no `data`, which suppressed
            // the send entirely; an empty ARRAY still went through (with an empty template id).
            if (templates == null) {
              this.sendingSms.set(false);
              return;
            }
            const template = templates.find((t) => t.deleted === false);
            const requests: SendSmsRequest[] = institutions.map((institution) => ({
              alternateNo,
              createdBy: this.sessionStore.user()?.userName,
              is1097: true,
              providerServiceMapID: serviceId,
              // Old app left this as the empty string when no active template matched.
              smsTemplateID: template?.smsTemplateID ?? '',
              smsTemplateTypeID: smsTypeID,
              instituteID: institution.institutionID,
              stateID: institution.stateID,
              districtID: institution.districtID,
              blockID: institution.blockID,
              beneficiaryRegID: this.callStore.beneficiaryRegId(),
            }));
            this.smsApi.sendSms(requests).subscribe({
              next: () => {
                this.sendingSms.set(false);
                this.notify.alert('SMS sent successfully', 'success');
              },
              error: () => this.sendingSms.set(false),
            });
          },
          error: () => this.sendingSms.set(false),
        });
      },
      error: () => this.sendingSms.set(false),
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
