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

import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';

import { AdminApiService, ServiceMasterRequest, ServiceMasterRow } from './admin-api.service';

/**
 * Service Master — super-admin tab 3 (old `admin-service-master`). List + create.
 *
 * Faithful port including the old screen's shape (approved as-is):
 *  - there is NO create/list toggle: the table and the form are both always visible;
 *  - the table has no pagination (unlike tabs 1 and 2);
 *  - the Edit and Delete icons had no click handlers, so they stay inert;
 *  - no maxlength on either input, and no validators at all;
 *  - save discards the response, shows no alert, does not reset and does not refresh the list.
 *
 * DECLARED DEVIATION: the old service hardcoded `http://localhost:8080/iEMR/ServiceMaster/...`,
 * which cannot resolve from a deployed client, so this screen never worked. Per the approved
 * decision the calls now resolve against the admin base (see `AdminApiService`).
 */
@Component({
  selector: 'app-admin-service-master',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-3 py-2">Service Name</th>
              <th class="px-3 py-2">Service Desc</th>
              <th class="px-3 py-2">Edit</th>
              <th class="px-3 py-2">Delete</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr class="border-t border-border">
                <td class="px-3 py-2">{{ row.ServiceName }}</td>
                <td class="px-3 py-2">{{ row.ServiceDesc }}</td>
                <!-- The old icons had no handlers; kept inert rather than inventing actions. -->
                <td class="px-3 py-2 text-muted-foreground">—</td>
                <td class="px-3 py-2 text-muted-foreground">—</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h4 class="text-base font-semibold">ServiceMaster Details</h4>

      <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label class="flex flex-col gap-1.5 text-sm">
          <span>ServiceName</span>
          <input z-input formControlName="serviceName" type="text" placeholder="Enter Service Name" />
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>ServiceDesc</span>
          <!-- The old placeholder key was missing from the language file and rendered empty. -->
          <input z-input formControlName="serviceDesc" type="text" />
        </label>
        <div class="flex items-end justify-end sm:col-span-2 lg:col-span-4">
          <button z-button type="submit">Save</button>
        </div>
      </form>
    </div>
  `,
})
export class AdminServiceMasterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);

  protected readonly rows = signal<ServiceMasterRow[]>([]);

  /** 6 controls in the old declaration order — that order IS the `saveService` key order. */
  protected readonly form = this.fb.group({
    serviceName: this.fb.control<string | null>(null),
    serviceDesc: this.fb.control<string | null>(null),
    createdBy: this.fb.control<string>('test', { nonNullable: true }),
    createdDate: this.fb.control<string>('2017-05-25', { nonNullable: true }),
    modifiedBy: this.fb.control<string>('test1', { nonNullable: true }),
    lastModDate: this.fb.control<string>('2017-05-26', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.api.getServiceMaster().subscribe({
      next: (data) => this.rows.set(Array.isArray(data) ? data : []),
      error: () => {
        // Old app funnelled errors into the success path but never reached `next`, so a failed
        // refresh left the previously loaded list on screen rather than emptying it.
      },
    });
  }

  /** Old `onSubmit` — response discarded, no alert, no reset, no list refresh. */
  protected submit(): void {
    this.api.saveServiceMaster(this.form.getRawValue() as ServiceMasterRequest).subscribe({
      next: () => {
        // Old app discarded the save response entirely — no alert, no reset.
      },
      error: () => {
        // Old app had no error handling here either.
      },
    });
  }
}
