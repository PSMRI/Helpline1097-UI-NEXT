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

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePhoneCall } from '@ng-icons/lucide';

import { cardImports } from '@common-ui/ui/card';

import { CallStore } from '@/app-modules/core/state/call.store';

/**
 * Inner-page STUB (old `RedirectToInnerpageComponent` → `InnerpageComponent`). Phase 4d only
 * proves the call-detection → navigation flow; the real call-handling screen (beneficiary
 * registration / history / closure / wrap-up) is Phase 5. Reached only mid-call (onCallGuard).
 */
@Component({
  selector: 'app-innerpage-stub',
  imports: [NgIcon, ...cardImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucidePhoneCall })],
  template: `
    <div class="mx-auto flex max-w-2xl flex-col items-center gap-4 p-8">
      <z-card class="w-full">
        <z-card-content class="flex flex-col items-center gap-3 py-10 text-center">
          <span
            class="flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-primary/10"
          >
            <ng-icon name="lucidePhoneCall" class="text-3xl text-primary" />
          </span>
          <h2 class="text-lg font-semibold">Call in progress</h2>
          <p class="text-2xl font-bold tracking-wide">{{ cli() || 'Unknown number' }}</p>
          @if (callCategory()) {
            <span
              class="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary"
            >
              {{ callCategory() }}
            </span>
          }
          <p class="mt-4 max-w-md text-sm text-muted-foreground">
            The call-handling screen (beneficiary registration, history and closure) arrives in a
            later phase. This page confirms the CTI call detection and navigation flow.
          </p>
        </z-card-content>
      </z-card>
    </div>
  `,
})
export class InnerpageStubComponent {
  private readonly callStore = inject(CallStore);
  protected readonly cli = this.callStore.cli;
  protected readonly callCategory = this.callStore.callCategory;
}
