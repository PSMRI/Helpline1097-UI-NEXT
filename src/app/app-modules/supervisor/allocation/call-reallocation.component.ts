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
  LanguageCountRow,
} from './allocation-api.service';
import {
  AllocateRecordsComponent,
  AllocationContext,
  FilterAgent,
} from './allocate-records.component';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { numOrNull } from '@/app-modules/core/utils/select-value';

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
 * Reallocation screen shared by the generic (case 13), grievance (30) and everwell (27)
 * supervisor pages: role → agent → per-language counts, then reallocate to another agent
 * or move back to the unallocated bin. No date filters — the old pickers were
 * display:none dead UI on every flavor and were never sent.
 */
@Component({
  selector: 'app-call-reallocation',
  imports: [
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardInputDirective,
    AllocateRecordsComponent,
    ...ZardSelectImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <form class="flex flex-wrap items-end gap-3" [formGroup]="form">
        <label class="flex min-w-44 flex-col gap-1.5 text-sm">
          <span>Role <span class="text-destructive">*</span></span>
          <z-select formControlName="roleID" zPlaceholder="Select role" (zValueChange)="onRoleChange()">
            @for (r of roles(); track r.roleID) {
              <z-select-item [zValue]="r.roleID + ''">{{ r.roleName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex min-w-52 flex-col gap-1.5 text-sm">
          <span>Agent <span class="text-destructive">*</span></span>
          <z-select formControlName="agentId" zPlaceholder="Select agent" (zValueChange)="onAgentSelected()">
            @for (a of agents(); track a.userID) {
              <z-select-item [zValue]="a.userID + ''">{{ a.firstName }} {{ a.lastName }}</z-select-item>
            }
          </z-select>
        </label>
      </form>

      @if (countRows().length) {
        <div class="overflow-x-auto rounded-md border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th class="px-3 py-2">Language</th>
                <th class="px-3 py-2">No. of Records</th>
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
                      <div class="flex justify-end gap-2">
                        <button z-button zSize="sm" zType="outline" type="button" (click)="moveToBin(row)">
                          Move to Bin
                        </button>
                        <button z-button zSize="sm" type="button" (click)="startReallocation(row)">
                          Reallocate
                        </button>
                      </div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (reallocationContext(); as ctx) {
        <app-allocate-records
          [flavor]="flavor()"
          [context]="ctx"
          [filterAgent]="selectedAgent()"
          (allocated)="refresh()"
        />
      }
    </div>
  `,
})
export class CallReallocationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AllocationApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);

  readonly flavor = input.required<AllocationFlavor>();

  protected readonly roles = signal<RoleRow[]>([]);
  protected readonly agents = signal<AgentRow[]>([]);
  protected readonly countRows = signal<LanguageCountRow[]>([]);
  protected readonly reallocationContext = signal<AllocationContext | null>(null);
  protected readonly selectedAgent = signal<FilterAgent | null>(null);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  protected readonly form = this.fb.group({
    roleID: this.fb.control<string | null>(null),
    agentId: this.fb.control<string | null>(null),
  });

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
              r.roleName?.trim().toUpperCase() !== 'PROVIDERADMIN' &&
              r.roleName?.trim().toUpperCase() !== 'SUPERVISOR',
          ),
        );
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load roles', 'error'),
    });
  }

  protected onRoleChange(): void {
    const serviceId = this.serviceId();
    const roleID = this.form.controls.roleID.value;
    this.agents.set([]);
    this.countRows.set([]);
    this.reallocationContext.set(null);
    this.form.patchValue({ agentId: null });
    if (serviceId == null || !roleID) {
      return;
    }
    // Old reallocation agents fetch carried no language filter (asymmetric vs allocation).
    this.api.getAgents(serviceId, numOrNull(roleID) ?? roleID).subscribe({
      next: (res) => this.agents.set(Array.isArray(res?.data) ? (res.data as AgentRow[]) : []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load agents', 'error'),
    });
  }

  protected onAgentSelected(): void {
    const serviceId = this.serviceId();
    const agentId = this.form.controls.agentId.value;
    this.reallocationContext.set(null);
    if (serviceId == null || !agentId) {
      return;
    }
    this.api
      .countByAgent(this.flavor(), serviceId, numOrNull(agentId) ?? agentId)
      .subscribe({
        next: (res) => {
          const rows = Array.isArray(res?.data) ? (res.data as LanguageCountRow[]) : [];
          this.countRows.set(rows);
          if (rows.length === 0) {
            this.notify.alert('No records available', 'info');
          }
        },
        error: (err: { errorMessage?: string }) =>
          this.notify.alert(err?.errorMessage ?? 'Failed to load records', 'error'),
      });
  }

  private agentName(): string {
    const agentId = this.form.controls.agentId.value;
    const agent = this.agents().find((a) => String(a.userID) === agentId);
    return `${agent?.firstName ?? ''} ${agent?.lastName ?? ''}`.trim();
  }

  protected startReallocation(row: LanguageCountRow): void {
    const agentId = this.form.controls.agentId.value ?? '';
    this.selectedAgent.set({
      agentName: this.agentName(),
      roleID: this.form.controls.roleID.value ?? '',
      languageName: row.language ?? '',
      assignedUserID: numOrNull(agentId) ?? agentId,
    });
    this.reallocationContext.set({
      language: row.language,
      noOfRecords: row.count,
      assignedUserID: numOrNull(agentId) ?? agentId,
      isAllocate: false,
    });
  }

  protected moveToBin(row: LanguageCountRow): void {
    const serviceId = this.serviceId();
    const agentId = this.form.controls.agentId.value;
    if (serviceId == null || !agentId) {
      return;
    }
    const userID = numOrNull(agentId) ?? agentId;

    if (this.flavor() === 'grievance') {
      // Old grievance bin posted directly, without a list fetch.
      this.api
        .moveToBin('grievance', {
          providerServiceMapID: serviceId,
          userID,
          preferredLanguageName: row.language,
          is1097: true,
          noOfCalls: row.count,
        })
        .subscribe({
          next: () => {
            this.notify.alert('Moved to bin successfully', 'success');
            this.refresh();
          },
          error: (err: { errorMessage?: string }) =>
            this.notify.alert(err?.errorMessage ?? 'Failed to move to bin', 'error'),
        });
      return;
    }

    // Generic/everwell: fetch the agent's records for the language, then reset by id.
    const body: Record<string, unknown> =
      this.flavor() === 'everwell'
        ? { providerServiceMapId: serviceId, agentId: userID, preferredLanguageName: row.language }
        : { providerServiceMapID: serviceId, assignedUserID: userID, preferredLanguageName: row.language, is1097: true };
    this.api.listForBin(this.flavor(), body).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
        const binBody =
          this.flavor() === 'everwell'
            ? { eapiIds: rows.map((r) => r['eapiId']) }
            : { outboundCallReqIDs: rows.map((r) => r['outboundCallReqID']) };
        this.api.moveToBin(this.flavor(), binBody).subscribe({
          next: () => {
            this.notify.alert('Moved to bin successfully', 'success');
            this.refresh();
          },
          error: (err: { errorMessage?: string }) =>
            this.notify.alert(err?.errorMessage ?? 'Failed to move to bin', 'error'),
        });
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load records', 'error'),
    });
  }

  protected refresh(): void {
    this.reallocationContext.set(null);
    this.onAgentSelected();
  }
}
