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

import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';

import { AdminApiService, ServiceProviderRequest, ServiceProviderRow } from './admin-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';

const ROWS_PER_PAGE = 8;

/** `yyyy-MM-dd` → the ISO datetime a local-midnight `Date` would serialise to. */
function isoFromInputDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toISOString();
}

/**
 * Service Provider master — super-admin tab 1 (old `admin-service-provider`).
 *
 * Faithful port, including the old screen's rough edges (all deliberate, approved as-is):
 *  - the form declares 39 controls but only 6 are rendered; the other 33 always POST `null`;
 *  - `createdBy`/`createdDate`/`stateId`/`joiningDate` are hardcoded test values;
 *  - "Address 1" and "Address 2" are two inputs bound to the SAME `address` control;
 *  - the required-name error shows immediately (no touched/dirty gate) and Save is never
 *    disabled, so an invalid form can still be submitted;
 *  - Edit only prefills 5 fields and captures no id, so saving creates a NEW provider rather
 *    than updating (the old `UpdateServiceProvider` endpoint was never wired up);
 *  - Delete asks for no confirmation, reports success before the response arrives, and replaces
 *    the list with whatever `Delete` returns instead of re-fetching;
 *  - the save and the list-refresh fire in parallel, so the list can refresh before the save
 *    commits.
 */
@Component({
  selector: 'app-admin-service-provider',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h4 class="text-base font-semibold">Provider Details</h4>
        @if (!showCreate()) {
          <button z-button type="button" (click)="toggleCreate()">Create</button>
        }
      </div>

      @if (!showCreate()) {
        <div class="overflow-x-auto rounded-md border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th class="px-3 py-2">Provider Name</th>
                <th class="px-3 py-2">Contact Person</th>
                <th class="px-3 py-2">Contact No</th>
                <th class="px-3 py-2">Edit</th>
                <th class="px-3 py-2">Delete</th>
              </tr>
            </thead>
            <tbody>
              @for (row of pagedRows(); track $index) {
                <tr class="border-t border-border">
                  <!-- Response keys are PascalCase while the save payload is camelCase. -->
                  <td class="px-3 py-2">{{ row.ServiceProviderName }}</td>
                  <td class="px-3 py-2">{{ row.PrimaryContactName }}</td>
                  <td class="px-3 py-2">{{ row.PrimaryContactNo }}</td>
                  <td class="px-3 py-2">
                    <button
                      type="button"
                      class="text-muted-foreground hover:text-foreground"
                      title="Edit"
                      (click)="editProvider(row)"
                    >
                      Edit
                    </button>
                  </td>
                  <td class="px-3 py-2">
                    <button
                      type="button"
                      class="text-destructive hover:text-destructive/80"
                      title="Delete"
                      (click)="deleteProvider(row)"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (rows().length) {
          <div class="flex items-center justify-end gap-3 text-sm">
            <span class="text-muted-foreground">Page {{ pageIndex() + 1 }} of {{ pageCount() }}</span>
            <button z-button zSize="sm" zType="outline" type="button" [zDisabled]="pageIndex() === 0" (click)="prevPage()">
              Prev
            </button>
            <button
              z-button
              zSize="sm"
              zType="outline"
              type="button"
              [zDisabled]="pageIndex() >= pageCount() - 1"
              (click)="nextPage()"
            >
              Next
            </button>
          </div>
        }
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label class="flex flex-col gap-1.5 text-sm">
            <span>Provider Name <span class="text-destructive">*</span></span>
            <input z-input formControlName="serviceProviderName" type="text" maxlength="30" placeholder="Enter Provider Name" />
            <!-- Old app showed this with no touched/dirty gate — visible on a pristine form. -->
            @if (form.controls.serviceProviderName.errors) {
              <span class="text-destructive">* Service Provider Name is required</span>
            }
          </label>
          <label class="flex flex-col gap-1.5 text-sm">
            <span>Validity</span>
            <input z-input formControlName="validity" type="date" />
          </label>
          <label class="flex flex-col gap-1.5 text-sm">
            <span>Contact Person Name</span>
            <input z-input formControlName="primaryContactName" type="text" maxlength="30" placeholder="Enter Contact Person Name" />
          </label>
          <label class="flex flex-col gap-1.5 text-sm">
            <span>Contact No.</span>
            <input z-input formControlName="primaryContactNo" type="text" maxlength="10" inputmode="numeric" />
          </label>
          <label class="flex flex-col gap-1.5 text-sm">
            <span>Email Id</span>
            <input z-input formControlName="emailID" type="text" placeholder="Enter Email Id" />
          </label>
          <!-- Address 1 and Address 2 are bound to the SAME control, exactly as the old app. -->
          <label class="flex flex-col gap-1.5 text-sm">
            <span>Address 1</span>
            <input z-input formControlName="address" type="text" placeholder="Enter Address" />
          </label>
          <label class="flex flex-col gap-1.5 text-sm">
            <span>Address 2</span>
            <input z-input formControlName="address" type="text" placeholder="Enter Address" />
          </label>
          <div class="flex items-end justify-end sm:col-span-2 lg:col-span-4">
            <!-- Never disabled on invalid, faithful to the old form. -->
            <button z-button type="submit">Save</button>
          </div>
        </form>
      }
    </div>
  `,
})
export class AdminServiceProviderComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly notify = inject(NotificationService);

  protected readonly rows = signal<ServiceProviderRow[]>([]);
  protected readonly showCreate = signal(false);
  protected readonly pageIndex = signal(0);

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.rows().length / ROWS_PER_PAGE)));
  protected readonly pagedRows = computed(() => {
    const start = this.pageIndex() * ROWS_PER_PAGE;
    return this.rows().slice(start, start + ROWS_PER_PAGE);
  });

  /**
   * All 39 controls in the old declaration order — `FormGroup.value` serialises in that order,
   * so this IS the `saveprovider` key order. Only 6 are rendered; the rest post `null`.
   */
  protected readonly form = this.fb.group({
    logoFilePath: this.fb.control<string | null>(null),
    primaryContactName: this.fb.control<string | null>(null),
    primaryContactNo: this.fb.control<string | null>(null),
    emailID: this.fb.control<string | null>(null),
    address: this.fb.control<string | null>(null),
    validity: this.fb.control<string | null>(null),
    roleName: this.fb.control<string | null>(null),
    roleDescription: this.fb.control<string | null>(null),
    services: this.fb.control<string | null>(null),
    minEducationalQualification: this.fb.control<string | null>(null),
    specialization: this.fb.control<string | null>(null),
    role: this.fb.control<string | null>(null),
    zoneDistrict: this.fb.control<string | null>(null),
    zoneName: this.fb.control<string | null>(null),
    stateParkingPlace: this.fb.control<string | null>(null),
    zoneParkingPlace: this.fb.control<string | null>(null),
    districtParkingPlace: this.fb.control<string | null>(null),
    parkingPlace: this.fb.control<string | null>(null),
    stateServicePoint: this.fb.control<string | null>(null),
    parkingPlaceServicePoint: this.fb.control<string | null>(null),
    servicePoint: this.fb.control<string | null>(null),
    loginID: this.fb.control<string | null>(null),
    pwd: this.fb.control<string | null>(null),
    firstName: this.fb.control<string | null>(null),
    lastName: this.fb.control<string | null>(null),
    education: this.fb.control<string | null>(null),
    employeeID: this.fb.control<string | null>(null),
    aadharNo: this.fb.control<string | null>(null),
    gender: this.fb.control<string | null>(null),
    panNo: this.fb.control<string | null>(null),
    father: this.fb.control<string | null>(null),
    mother: this.fb.control<string | null>(null),
    emergencyContactPerson: this.fb.control<string | null>(null),
    emergencyContactNo: this.fb.control<string | null>(null),
    serviceProviderName: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    // Hardcoded audit/tenant values, shipped on every create by the old app.
    createdBy: this.fb.control<string>('test', { nonNullable: true }),
    createdDate: this.fb.control<string>('2017-01-01', { nonNullable: true }),
    stateId: this.fb.control<string>('1', { nonNullable: true }),
    joiningDate: this.fb.control<string>('2017-01-01', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.loadProviders();
  }

  private loadProviders(): void {
    this.api.getProviders().subscribe({
      next: (data) => {
        this.rows.set(Array.isArray(data) ? data : []);
        this.pageIndex.set(0);
      },
      // The old service funnelled errors into the success path and showed nothing.
      error: () => {
        // Old app funnelled errors into the success path but never reached `next`, so a failed
        // refresh left the previously loaded list on screen rather than emptying it.
      },
    });
  }

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }
  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  /** Old `showCreate()` — a plain toggle, reused for open, close and edit. */
  protected toggleCreate(): void {
    this.showCreate.update((v) => !v);
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    // The old field was a Material datepicker, so the control held a `Date` and serialised as
    // an ISO datetime (local midnight → UTC). A native date input yields `yyyy-MM-dd`, so
    // convert to keep the posted value's shape identical.
    const body = {
      ...raw,
      validity: raw.validity ? isoFromInputDay(raw.validity) : raw.validity,
    } as ServiceProviderRequest;
    // Old app fired save and the list refresh in PARALLEL (unsequenced) and discarded the save
    // response entirely — no success alert, no error handling, and the form was never reset.
    this.api.saveProvider(body).subscribe({
      next: () => {
        // Old app discarded the save response entirely — no alert, no reset.
      },
      error: () => {
        // Old app had no error handling here either.
      },
    });
    this.loadProviders();
    this.toggleCreate();
  }

  /**
   * Old `updateSP` — prefills 5 fields and opens the form. No id is captured, so Save posts
   * `saveprovider` and creates a duplicate rather than updating. `validity` is not prefilled,
   * and `emailID`/`address` are read in camelCase while the other three are PascalCase (so
   * those two usually arrive undefined).
   */
  protected editProvider(row: ServiceProviderRow): void {
    this.form.patchValue({
      serviceProviderName: row.ServiceProviderName ?? '',
      primaryContactName: row.PrimaryContactName ?? null,
      primaryContactNo: row.PrimaryContactNo ?? null,
      // Deliberately NOT `?? null`: these two are read in camelCase off a PascalCase row, so
      // they are normally `undefined` — and `JSON.stringify` then DROPS both keys, exactly as
      // the old app did (its Edit→Save body carried 37 keys, not 39).
      emailID: row.emailID as string | null,
      address: row.address as string | null,
    });
    this.toggleCreate();
  }

  /**
   * Old `deleteSP` — no confirmation, the id is sent as a string, the response REPLACES the
   * list (rather than re-fetching), and the success alert fires synchronously before the
   * request completes, so it always claims success.
   */
  protected deleteProvider(row: ServiceProviderRow): void {
    this.api.deleteProvider(String(row.ServiceProviderId)).subscribe({
      next: (data) => this.rows.set(Array.isArray(data) ? data : []),
      error: () => {
        // Old app had no error handling here.
      },
    });
    this.notify.alert('data deleted', 'success');
  }
}
