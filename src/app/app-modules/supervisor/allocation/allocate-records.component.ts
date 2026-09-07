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
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { AllocationApiService, AllocationFlavor, dayBoundary } from './allocation-api.service';
import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { LanguageStore } from '@/app-modules/core/state/language.store';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { numOrNull } from '@/app-modules/core/utils/select-value';

/** Context handed down by the allocation/reallocation parents (old `outboundCallRequests`). */
export interface AllocationContext {
  /** Raw picker dates (the old app posted these instants on the grievance allocate too). */
  startDate?: Date;
  endDate?: Date;
  language?: string;
  noOfRecords?: number;
  assignedUserID?: number | string;
  isAllocate?: boolean;
}

export interface FilterAgent {
  agentName: string;
  roleID: number | string;
  languageName: string;
  assignedUserID: number | string;
}

interface RoleRow {
  roleID?: number | string;
  roleName?: string;
}

interface AgentRow {
  userID?: number | string;
  firstName?: string;
  lastName?: string;
}

/**
 * Shared allocate-to-agents form (the old app had three near-identical copies:
 * `outbound-allocate-records`, grievance and everwell `*-allocate-records`).
 * Role → agents (multi) → count, then the flavor's allocation endpoint.
 */
@Component({
  selector: 'app-allocate-records',
  imports: [
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardInputDirective,
    TranslatePipe,
    ...ZardSelectImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-wrap items-end gap-3 rounded-md border border-border p-3" [formGroup]="form">
      @if (context().language) {
        <div class="flex flex-col gap-1.5 text-sm">
          <span class="text-muted-foreground">{{ 'preferredLanguage' | t }}</span>
          <span class="font-medium">{{ context().language }}</span>
        </div>
      }
      <label class="flex min-w-44 flex-col gap-1.5 text-sm">
        <span>{{ 'role' | t }} <span class="text-destructive">*</span></span>
        <z-select formControlName="roleID" [zPlaceholder]="'selectRole' | t" (zValueChange)="onRoleChange($event)">
          @for (r of roles(); track r.roleID) {
            <z-select-item [zValue]="r.roleID + ''">{{ r.roleName }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex min-w-52 flex-col gap-1.5 text-sm">
        <span>Agents <span class="text-destructive">*</span></span>
        <z-select formControlName="agents" [zMultiple]="true" [zPlaceholder]="'allocateTo' | t" [zDisabled]="agents().length === 0" (zValueChange)="onAgentsChange($event)">
          @for (a of agents(); track a.userID) {
            <z-select-item [zValue]="a.userID + ''">{{ a.firstName }} {{ a.lastName }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex w-36 flex-col gap-1.5 text-sm">
        <span>{{ 'allocateNoOfRecords' | t }} <span class="text-destructive">*</span></span>
        <input z-input formControlName="allocateNo" type="number" (change)="clampAllocateNo()" />
      </label>
      <button z-button type="button" [zDisabled]="form.invalid || agentsSelected().length === 0" [zLoading]="saving()" (click)="allocate()">
        {{ 'allocate' | t }}
      </button>
      @if (noAgents()) {
        <p class="w-full text-sm text-destructive">{{ 'noAgentsAvailableForThisLanguage' | t }}</p>
      }
    </form>
  `,
})
export class AllocateRecordsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AllocationApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly lang = inject(LanguageStore);

  readonly flavor = input.required<AllocationFlavor>();
  readonly context = input.required<AllocationContext>();
  readonly filterAgent = input<FilterAgent | null>(null);
  readonly allocated = output<void>();

  protected readonly roles = signal<RoleRow[]>([]);
  protected readonly agents = signal<AgentRow[]>([]);
  protected readonly noAgents = signal(false);
  protected readonly saving = signal(false);
  /** The full agents multi-selection. The pinned Common-UI writes only the last-clicked
   * scalar to the form control, so `(zValueChange)` is the reliable source for the array. */
  protected readonly agentsSelected = signal<string[]>([]);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  private recordList: unknown[] = [];
  private initialCount = 0;

  protected readonly form = this.fb.group({
    roleID: this.fb.control<string | null>(null, Validators.required),
    // Selection is tracked via `agentsSelected` (multi-mode CVA is unreliable); the control
    // stays for display/reset, and the Allocate button gates on the signal length instead.
    agents: this.fb.control<string[]>([]),
    allocateNo: this.fb.control<number | null>(null, Validators.required),
  });

  constructor() {
    effect(() => {
      this.context();
      this.onContextChange();
    });
  }

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.getRoles(serviceId).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.data) ? (res.data as RoleRow[]) : [];
        this.roles.set(
          rows.filter(
            (r) =>
              r.roleName?.toLowerCase() !== 'supervisor' &&
              r.roleName?.toLowerCase() !== 'provideradmin',
          ),
        );
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load roles', 'error'),
    });
  }

  private onContextChange(): void {
    const ctx = this.context();
    const serviceId = this.serviceId();
    this.form.reset({ agents: [] });
    this.agentsSelected.set([]);
    this.agents.set([]);
    this.noAgents.set(false);
    this.recordList = [];

    if (this.flavor() === 'grievance') {
      // The old grievance child never fetched a list — count comes with the context
      // (allocateNo prefill happens on role change, like the old app).
      this.initialCount = ctx.noOfRecords ?? 0;
    } else if (serviceId != null) {
      this.fetchRecords(ctx, serviceId);
    }

    const agent = this.filterAgent();
    if (agent) {
      this.form.patchValue({ roleID: String(agent.roleID) });
      this.loadAgents(agent.roleID, agent.languageName);
    }
  }

  private fetchRecords(ctx: AllocationContext, serviceId: number): void {
    const options: Parameters<AllocationApiService['listRecords']>[2] = ctx.assignedUserID
      ? { assignedUserID: ctx.assignedUserID, preferredLanguageName: ctx.language }
      : this.flavor() === 'everwell'
        ? {
            // Old everwell child used the tz-shifted day boundaries with a `.999Z` end (unlike
            // generic, which posted the raw local-midnight instants) — this list becomes the
            // allocate payload, so the window must match.
            filterStartDate: ctx.startDate ? dayBoundary(ctx.startDate, 'start') : undefined,
            filterEndDate: ctx.endDate ? dayBoundary(ctx.endDate, 'end999') : undefined,
            preferredLanguageName: ctx.language,
          }
        : {
            filterStartDate: this.normalized(ctx.startDate, 'start'),
            filterEndDate: this.normalized(ctx.endDate, 'end'),
            preferredLanguageName: ctx.language,
          };
    this.api.listRecords(this.flavor(), serviceId, options).subscribe({
      next: (res) => {
        this.recordList = Array.isArray(res?.data) ? res.data : [];
        // Old generic/everwell children never prefilled allocateNo from the fetch; and the
        // old everwell child's upper clamp never fired (its initialCount read the envelope
        // and stayed undefined), so everwell keeps no upper bound.
        this.initialCount = this.flavor() === 'everwell' ? Infinity : this.recordList.length;
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load records', 'error'),
    });
  }

  /** Old child re-normalized the picker date to the day edge before posting (ISO string). */
  private normalized(date: Date | undefined, edge: 'start' | 'end'): string | undefined {
    if (!date) {
      return undefined;
    }
    const d = new Date(date);
    if (edge === 'start') {
      d.setHours(0, 0, 0, 0);
    } else {
      d.setHours(23, 59, 59, 0);
    }
    return d.toJSON();
  }

  // Handlers take the emitted value: z-select fires zValueChange BEFORE its CVA writes the
  // form control, so reading the control here would see the previous selection.
  protected onRoleChange(value: string | string[]): void {
    const roleID = value as string;
    this.agentsSelected.set([]);
    // Only the old grievance child prefilled allocateNo on role change.
    if (this.flavor() === 'grievance') {
      this.form.patchValue({ agents: [], allocateNo: this.context().noOfRecords ?? 0 });
    } else {
      this.form.patchValue({ agents: [] });
    }
    if (roleID) {
      this.loadAgents(roleID, this.context().language);
    }
  }

  private loadAgents(roleID: number | string, languageName?: string): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.getAgents(serviceId, numOrNull(String(roleID)) ?? roleID, languageName).subscribe({
      next: (res) => {
        let rows = Array.isArray(res?.data) ? (res.data as AgentRow[]) : [];
        const excluded = this.filterAgent();
        if (excluded) {
          rows = rows.filter((a) => `${a.firstName} ${a.lastName}` !== excluded.agentName);
        }
        this.agents.set(rows);
        this.noAgents.set(rows.length === 0);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load agents', 'error'),
    });
  }

  /** Old `OnSelectChange` — split the pool evenly across the selected agents. Deselecting
   * all resets to the full pool (old grievance branch; the old generic/everwell divided by
   * zero here — declared non-replication). */
  protected onAgentsChange(value: string | string[]): void {
    const selected = Array.isArray(value) ? value : [];
    this.agentsSelected.set(selected);
    const pool =
      this.flavor() === 'grievance' ? (this.context().noOfRecords ?? 0) : this.recordList.length;
    if (selected.length > 0) {
      const share = Math.floor(pool / selected.length);
      this.initialCount = share;
      this.form.patchValue({ allocateNo: share });
    } else {
      this.form.patchValue({ allocateNo: pool });
    }
  }

  /** Old `validate` — flavor-specific: grievance resets any out-of-range value to 0;
   * generic clears below 1 and clamps above the pool; everwell only clears below 1. */
  protected clampAllocateNo(): void {
    const value = this.form.controls.allocateNo.value;
    if (value == null) {
      return;
    }
    if (this.flavor() === 'grievance') {
      if (value < 1 || value > this.initialCount) {
        this.form.patchValue({ allocateNo: 0 });
      }
      return;
    }
    if (value < 1) {
      this.form.patchValue({ allocateNo: null });
    } else if (value > this.initialCount) {
      this.form.patchValue({ allocateNo: this.initialCount });
    }
  }

  protected allocate(): void {
    const v = this.form.getRawValue();
    const ctx = this.context();
    const agentIds = this.agentsSelected().map((id) => numOrNull(id) ?? id);
    this.saving.set(true);

    const request$ =
      this.flavor() === 'grievance'
        ? this.api.allocateGrievance(
            {
              // Old app posted the RAW picker instants, not the count-query boundaries.
              startDate: ctx.startDate?.toJSON(),
              endDate: ctx.endDate?.toJSON(),
              providerServiceMapId: this.serviceId(),
              language: ctx.language,
              fromUserId: ctx.assignedUserID,
              roleID: numOrNull(v.roleID),
              touserID: agentIds,
              allocateNo: v.allocateNo,
            },
            ctx.isAllocate !== false,
          )
        : this.flavor() === 'everwell'
          ? this.api.allocateEverwell({
              roleID: numOrNull(v.roleID) ?? '',
              agentId: agentIds,
              allocateNo: v.allocateNo ?? 0,
              outboundCallRequests: this.recordList,
            })
          : this.api.allocateGeneric({
              roleID: numOrNull(v.roleID) ?? '',
              userID: agentIds,
              allocateNo: v.allocateNo ?? 0,
              outboundCallRequests: this.recordList,
            });

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.alert(this.lang.t('callAllocatedSuccessfully'), 'success');
        this.form.reset({ agents: [] });
        this.allocated.emit();
      },
      error: (err: { status?: number; errorMessage?: string }) => {
        this.saving.set(false);
        // Old generic/grievance handlers alerted the bare HTTP status; everwell alerted
        // the error message.
        this.notify.alert(
          this.flavor() === 'everwell'
            ? (err?.errorMessage ?? 'error')
            : String(err?.status ?? 'error'),
          'error',
        );
      },
    });
  }
}
