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

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { cardImports } from '@common-ui/ui/card';

/** One call-statistics metric tile. */
interface StatTile {
  label: string;
  value: string;
  time: boolean;
}

/**
 * Call-statistics — 4 flat tiles (Call Duration / Break Time / Free Time / Total Calls),
 * old `call-statistics`. This is the layout only; the values come from the CTI
 * `getAgentCallStats` call wired in Phase 4d. `blank` mode is used for Supervisor.
 */
@Component({
  selector: 'app-call-statistics',
  imports: [...cardImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      @for (tile of tiles; track tile.label) {
        <z-card class="text-center">
          <z-card-content class="flex flex-col gap-1 py-4">
            <span class="text-2xl font-semibold text-primary">{{ blank() ? '—' : tile.value }}</span>
            <span class="text-xs text-muted-foreground">{{ tile.label }}</span>
            @if (tile.time) {
              <span class="text-[10px] uppercase tracking-wide text-muted-foreground">Hrs : Mins : Secs</span>
            }
          </z-card-content>
        </z-card>
      }
    </div>
  `,
})
export class CallStatisticsComponent {
  /** Supervisor sees the tiles blanked (no per-agent call stats). */
  readonly blank = input(false);

  // Placeholder values until Phase 4d wires CTI getAgentCallStats.
  protected readonly tiles: StatTile[] = [
    { label: 'Call Duration', value: '00:00:00', time: true },
    { label: 'Break Time', value: '00:00:00', time: true },
    { label: 'Free Time', value: '00:00:00', time: true },
    { label: 'Total Calls', value: '0', time: false },
  ];
}
