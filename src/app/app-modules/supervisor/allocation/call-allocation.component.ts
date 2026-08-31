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
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import {
  AllocationApiService,
  AllocationFlavor,
  dayBoundary,
  LanguageCountRow,
  localDate,
} from './allocation-api.service';
import { AllocateRecordsComponent, AllocationContext } from './allocate-records.component';
import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';
import { CallApiService } from '@/app-modules/core/services/call-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Unallocated-calls allocation screen, shared by the generic (case 12), grievance (29) and
 * everwell (26) supervisor pages (the old app had three near-identical components).
 * Default window = today → today+7 (old boundary strings).
 */
@Component({
  selector: 'app-call-allocation',
  imports: [
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardInputDirective,
    AllocateRecordsComponent,
    TranslatePipe,
    ...ZardSelectImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted-foreground">
        {{ 'noteDefaultCallsBetweenTodayAndNextSevenDays' | t }}
      </p>
      <form class="flex flex-wrap items-end gap-3" [formGroup]="form">
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'validFrom' | t }}</span>
          <input z-input formControlName="startDate" type="date" />
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'validTill' | t }}</span>
          <input z-input formControlName="endDate" type="date" [min]="form.controls.startDate.value" />
        </label>
        <label class="flex min-w-44 flex-col gap-1.5 text-sm">
          <span>{{ 'language' | t }}</span>
          <z-select formControlName="language" zPlaceholder="All">
            <z-select-item zValue="">All</z-select-item>
            @for (l of languages(); track l.languageID) {
              <z-select-item [zValue]="l.languageName + ''">{{ l.languageName }}</z-select-item>
            }
          </z-select>
        </label>
        <button z-button type="button" [zDisabled]="form.invalid" (click)="search()">
          {{ 'search' | t }}
        </button>
      </form>

      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-3 py-2">{{ 'languageName' | t }}</th>
              <th class="px-3 py-2">{{ 'noOfRecords' | t }}</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            @for (row of countRows(); track $index) {
              <tr class="border-t border-border">
                <td class="px-3 py-2">{{ row.language }}</td>
                <td class="px-3 py-2">{{ row.count }}</td>
                <td class="px-3 py-2 text-right">
                  @if (row.language !== 'All') {
                    <button
                      z-button
                      zSize="sm"
                      type="button"
                      [zDisabled]="row.count === 0"
                      (click)="startAllocation(row)"
                    >
                      {{ 'allocate' | t }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="3" class="px-3 py-6 text-center text-muted-foreground">
                  {{ 'noRecordsFound' | t }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (allocationContext(); as ctx) {
        <app-allocate-records [flavor]="flavor()" [context]="ctx" (allocated)="refresh()" />
      }
    </div>
  `,
})
export class CallAllocationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AllocationApiService);
  private readonly callApi = inject(CallApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);

  readonly flavor = input.required<AllocationFlavor>();

  protected readonly countRows = signal<LanguageCountRow[]>([]);
  protected readonly languages = signal<{ languageID?: number; languageName?: string }[]>([]);
  protected readonly allocationContext = signal<AllocationContext | null>(null);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  private lastWindow: { start: string; end: string; language?: string } | null = null;

  protected readonly form = this.fb.group({
    startDate: this.fb.control<string | null>(null),
    endDate: this.fb.control<string | null>(null),
    language: this.fb.control<string>('', { nonNullable: true }),
  });

  ngOnInit(): void {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 7);
    const asInput = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.form.patchValue({ startDate: asInput(start), endDate: asInput(end) });
    this.fetchCounts(dayBoundary(start, 'start'), dayBoundary(end, 'end'));
    this.callApi.getLanguages().subscribe({
      next: (res) => this.languages.set(Array.isArray(res?.data) ? res.data : []),
      error: () => this.languages.set([]),
    });
  }

  protected search(): void {
    const v = this.form.getRawValue();
    if (!v.startDate || !v.endDate) {
      return;
    }
    this.allocationContext.set(null);
    this.fetchCounts(
      dayBoundary(localDate(v.startDate), 'start'),
      dayBoundary(localDate(v.endDate), 'end'),
      v.language || undefined,
    );
  }

  private fetchCounts(start: string, end: string, language?: string): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.lastWindow = { start, end, language };
    this.api.countUnallocated(this.flavor(), serviceId, start, end, language).subscribe({
      next: (res) => this.countRows.set(Array.isArray(res?.data) ? (res.data as LanguageCountRow[]) : []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load counts', 'error'),
    });
  }

  protected startAllocation(row: LanguageCountRow): void {
    const v = this.form.getRawValue();
    this.allocationContext.set({
      startDate: v.startDate ? localDate(v.startDate) : undefined,
      endDate: v.endDate ? localDate(v.endDate) : undefined,
      language: row.language,
      noOfRecords: row.count,
      isAllocate: true,
    });
  }

  protected refresh(): void {
    this.allocationContext.set(null);
    // Old parents refetched WITHOUT the language filter after an allocation.
    if (this.lastWindow) {
      this.fetchCounts(this.lastWindow.start, this.lastWindow.end);
    }
  }
}
