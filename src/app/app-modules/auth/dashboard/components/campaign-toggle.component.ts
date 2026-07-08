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
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ZardRadioComponent } from '@common-ui/ui/radio';

import { CtiService } from '@/app-modules/core/services/cti.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** Old radio values kept verbatim: '1' = INBOUND, '0' = OUTBOUND. */
type CampaignValue = '1' | '0';

/**
 * INBOUND/OUTBOUND campaign toggle — faithful port of the old dashboard's `setCampaign()`
 * (initial mode from the role's `inbound`/`outbound` privileges) and `campaign(value)`
 * (confirm dialog → `cti/switchToInbound|switchToOutbound` → persist `current_campaign`,
 * revert the radio on cancel/error). CO only — the dashboard hides it for Supervisor.
 */
@Component({
  selector: 'app-campaign-toggle',
  imports: [ReactiveFormsModule, ZardRadioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-5" role="radiogroup" aria-label="Campaign mode">
      @if (showInbound()) {
        <label z-radio name="inOutBound" value="1" [formControl]="control">Inbound</label>
      }
      @if (showOutbound()) {
        <label z-radio name="inOutBound" value="0" [formControl]="control">Outbound</label>
      }
    </div>
  `,
})
export class CampaignToggleComponent implements OnInit {
  private readonly cti = inject(CtiService);
  private readonly callStore = inject(CallStore);
  private readonly sessionStore = inject(SessionStore);
  private readonly notify = inject(NotificationService);

  protected readonly showInbound = signal(false);
  protected readonly showOutbound = signal(false);

  protected readonly control = new FormControl<CampaignValue>('1', { nonNullable: true });

  /** Last applied value, to revert the radio when the user cancels or the switch fails. */
  private applied: CampaignValue = '1';

  ngOnInit(): void {
    this.setCampaign();
    this.control.valueChanges.subscribe((value) => {
      if (value !== this.applied) {
        this.onToggle(value);
      }
    });
  }

  /** Old `setCampaign()`: initial campaign from the current role's inbound/outbound flags. */
  private setCampaign(): void {
    const roleId = this.sessionStore.currentRoleId();
    const role = this.sessionStore
      .privileges()
      .flatMap((privilege) => privilege.roles ?? [])
      .find((r) => r.RoleID === roleId);
    if (!role) {
      return;
    }

    if (role.inbound === true && role.outbound === true) {
      this.showInbound.set(true);
      this.showOutbound.set(true);
      if (this.callStore.currentCampaign() === 'OUTBOUND') {
        this.setControl('0');
      } else {
        this.callStore.setCurrentCampaign('INBOUND');
        this.setControl('1');
      }
    } else if (role.inbound === true) {
      this.showInbound.set(true);
      this.callStore.setCurrentCampaign('INBOUND');
      this.setControl('1');
    } else if (role.outbound === true) {
      // Only-outbound role: the old app auto-switched the agent to OUTBOUND on load and
      // persisted the campaign even when the switch call failed (agent already in MANUAL).
      this.showOutbound.set(true);
      this.setControl('0');
      this.cti.switchToOutbound().subscribe({
        next: () => this.callStore.setCurrentCampaign('OUTBOUND'),
        error: () => this.callStore.setCurrentCampaign('OUTBOUND'),
      });
    }
  }

  /** Old `campaign(value)`: confirm, call the switch endpoint, persist or revert. */
  private onToggle(value: CampaignValue): void {
    const inbound = value === '1';
    this.notify.confirm(inbound ? 'Switch to Inbound?' : 'Switch to Outbound?').subscribe({
      next: (confirmed) => {
        if (!confirmed) {
          this.revert();
          return;
        }
        const switchCall = inbound ? this.cti.switchToInbound() : this.cti.switchToOutbound();
        switchCall.subscribe({
          next: () => {
            this.applied = value;
            this.callStore.setCurrentCampaign(inbound ? 'INBOUND' : 'OUTBOUND');
          },
          error: (err: { errorMessage?: string }) => {
            this.notify.alert(err?.errorMessage ?? 'Failed to switch campaign', 'error');
            this.revert();
          },
        });
      },
    });
  }

  private setControl(value: CampaignValue): void {
    this.applied = value;
    this.control.setValue(value, { emitEvent: false });
  }

  private revert(): void {
    this.control.setValue(this.applied, { emitEvent: false });
  }
}
