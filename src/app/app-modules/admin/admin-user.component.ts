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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';

import { AdminApiService, AdminUserRequest, AdminUserRow } from './admin-api.service';

const ROWS_PER_PAGE = 8;

/**
 * Admin User master — super-admin tab 2 (old `admin-user`). List + create only.
 *
 * Faithful port including the old screen's rough edges (approved as-is):
 *  - the table's Edit and Delete icons had NO click handlers at all, so they are rendered as
 *    inert text here rather than being invented;
 *  - the list reads mixed casing — `FirstName` and `UserName` are PascalCase but `lastName` is
 *    camelCase, so that column usually renders blank;
 *  - `titleID`/`statusID` and the audit fields are hardcoded (and use different dates from the
 *    Service Provider form);
 *  - `userName` carried a plain HTML `required` inside a reactive form, i.e. no validation at
 *    all — kept non-blocking;
 *  - save discards the response, shows no alert, does not reset the form and — unlike tab 1 —
 *    does not refresh the list.
 */
@Component({
  selector: 'app-admin-user',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h4 class="text-base font-semibold">User Details</h4>
        @if (!showCreate()) {
          <button z-button type="button" (click)="toggleCreate()">Create</button>
        }
      </div>

      @if (!showCreate()) {
        <div class="overflow-x-auto rounded-md border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th class="px-3 py-2">First Name</th>
                <th class="px-3 py-2">Last Name</th>
                <th class="px-3 py-2">User Name</th>
                <th class="px-3 py-2">Edit</th>
                <th class="px-3 py-2">Delete</th>
              </tr>
            </thead>
            <tbody>
              @for (row of pagedRows(); track $index) {
                <tr class="border-t border-border">
                  <!-- Mixed casing is the old app's: FirstName / lastName / UserName. -->
                  <td class="px-3 py-2">{{ row.FirstName }}</td>
                  <td class="px-3 py-2">{{ row.lastName }}</td>
                  <td class="px-3 py-2">{{ row.UserName }}</td>
                  <!-- The old icons had no handlers; kept inert rather than inventing actions. -->
                  <td class="px-3 py-2 text-muted-foreground">—</td>
                  <td class="px-3 py-2 text-muted-foreground">—</td>
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
            <span>First Name</span>
            <input z-input formControlName="firstName" type="text" maxlength="50" placeholder="Enter FirstName Name" />
          </label>
          <label class="flex flex-col gap-1.5 text-sm">
            <!-- The old label key was missing from the language file and rendered empty. -->
            <span>Middle Name</span>
            <input z-input formControlName="middleName" type="text" maxlength="50" placeholder="Enter Middlename" />
          </label>
          <label class="flex flex-col gap-1.5 text-sm">
            <span>Last Name</span>
            <input z-input formControlName="lastName" type="text" maxlength="50" placeholder="Enter Lastname" />
          </label>
          <label class="flex flex-col gap-1.5 text-sm">
            <span>User Name</span>
            <input z-input formControlName="userName" type="text" maxlength="20" placeholder="Enter Username" />
          </label>
          <label class="flex flex-col gap-1.5 text-sm">
            <span>Password</span>
            <input z-input formControlName="password" type="password" maxlength="20" placeholder="Enter Password" />
          </label>
          <div class="flex items-end justify-end sm:col-span-2 lg:col-span-4">
            <button z-button type="submit">Save</button>
          </div>
        </form>
      }
    </div>
  `,
})
export class AdminUserComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);

  protected readonly rows = signal<AdminUserRow[]>([]);
  protected readonly showCreate = signal(false);
  protected readonly pageIndex = signal(0);

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.rows().length / ROWS_PER_PAGE)));
  protected readonly pagedRows = computed(() => {
    const start = this.pageIndex() * ROWS_PER_PAGE;
    return this.rows().slice(start, start + ROWS_PER_PAGE);
  });

  /** 11 controls in the old declaration order — that order IS the `saveUser` key order. */
  protected readonly form = this.fb.group({
    firstName: this.fb.control<string | null>(null),
    middleName: this.fb.control<string | null>(null),
    lastName: this.fb.control<string | null>(null),
    titleID: this.fb.control<string>('1', { nonNullable: true }),
    userName: this.fb.control<string | null>(null),
    password: this.fb.control<string | null>(null),
    statusID: this.fb.control<string>('1', { nonNullable: true }),
    createdBy: this.fb.control<string>('test', { nonNullable: true }),
    createdDate: this.fb.control<string>('2017-05-25', { nonNullable: true }),
    modifiedBy: this.fb.control<string>('test1', { nonNullable: true }),
    lastModDate: this.fb.control<string>('2017-05-26', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.api.getUsers().subscribe({
      next: (data) => {
        this.rows.set(Array.isArray(data) ? data : []);
        this.pageIndex.set(0);
      },
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

  protected toggleCreate(): void {
    this.showCreate.update((v) => !v);
  }

  /** Old `onSubmit` — response discarded, no alert, no reset, and no list refresh. */
  protected submit(): void {
    this.api.saveUser(this.form.getRawValue() as AdminUserRequest).subscribe({
      next: () => {
        // Old app discarded the save response entirely — no alert, no reset.
      },
      error: () => {
        // Old app had no error handling here either.
      },
    });
    this.toggleCreate();
  }
}
