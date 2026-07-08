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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideClock, lucideCoffee, lucidePhone, lucidePhoneCall } from '@ng-icons/lucide';

import { cardImports } from '@common-ui/ui/card';

import { AgentCallStatsData, CtiService } from '@/app-modules/core/services/cti.service';

/** One call-statistics metric tile. */
interface StatTile {
  label: string;
  value: string;
  time: boolean;
  icon: string;
}

/**
 * Call-statistics — 4 flat tiles (Call Duration / Break Time / Free Time / Total Calls),
 * old `call-statistics`. Values come from one `cti/getAgentCallStats` call on load (the old
 * app fetched once in ngOnInit, no polling) and are displayed verbatim, as the old app did.
 * `blank` mode is used for Supervisor (no per-agent stats, no fetch).
 */
@Component({
  selector: 'app-call-statistics',
  imports: [...cardImports, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucidePhone, lucideCoffee, lucideClock, lucidePhoneCall })],
  template: `
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      @for (tile of tiles(); track tile.label) {
        <z-card class="border-l-4 border-primary/70 shadow-sm transition-shadow hover:shadow-md">
          <z-card-content class="flex items-center gap-3 py-4">
            <ng-icon [name]="tile.icon" class="text-2xl text-primary/70" />
            <div class="flex min-w-0 flex-col">
              <span class="text-2xl font-semibold text-foreground">
                {{ blank() ? '—' : tile.value }}
              </span>
              <span class="text-xs text-muted-foreground">{{ tile.label }}</span>
              @if (tile.time) {
                <span class="text-[11px] tracking-wider text-muted-foreground/80">Hrs : Mins : Secs</span>
              }
            </div>
          </z-card-content>
        </z-card>
      }
    </div>
  `,
})
export class CallStatisticsComponent implements OnInit {
  private readonly cti = inject(CtiService);

  /** Supervisor sees the tiles blanked (no per-agent call stats). */
  readonly blank = input(false);

  // Raw getAgentCallStats payload; placeholders render per-field until it arrives
  // (old app showed empty until then).
  private readonly stats = signal<AgentCallStatsData | null>(null);

  protected readonly tiles = computed<StatTile[]>(() => {
    const stats = this.stats();
    const value = (field: number | string | undefined, placeholder: string): string =>
      field != null ? String(field) : placeholder;
    return [
      {
        label: 'Call Duration',
        value: value(stats?.total_call_duration, '00:00:00'),
        time: true,
        icon: 'lucidePhone',
      },
      {
        label: 'Break Time',
        value: value(stats?.total_break_time, '00:00:00'),
        time: true,
        icon: 'lucideCoffee',
      },
      {
        label: 'Free Time',
        value: value(stats?.total_free_time, '00:00:00'),
        time: true,
        icon: 'lucideClock',
      },
      {
        label: 'Total Calls',
        value: value(stats?.total_calls, '0'),
        time: false,
        icon: 'lucidePhoneCall',
      },
    ];
  });

  ngOnInit(): void {
    if (this.blank()) {
      return;
    }
    // Old `todayCallLists()` — one fetch on load, values rendered verbatim.
    this.cti.getCallDetails().subscribe({
      next: (res) => this.stats.set(res?.data ?? null),
      error: () => {
        // Old app only logged this; tiles keep their zero placeholders.
      },
    });
  }
}
