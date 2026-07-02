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

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { cardImports } from '@common-ui/ui/card';

/**
 * Reports panel. In the OLD app this is a STATIC placeholder table (dummy rows, a
 * non-functional "More…" link) — preserved faithfully here until a real reports
 * feature is migrated.
 */
@Component({
  selector: 'app-reports-panel',
  imports: [...cardImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-card class="h-full">
      <z-card-header>
        <z-card-title class="text-lg">Reports</z-card-title>
      </z-card-header>
      <z-card-content>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-left text-muted-foreground">
              <th class="py-1.5 pr-4 font-medium">S.No</th>
              <th class="py-1.5 pr-4 font-medium">Report Name</th>
              <th class="py-1.5 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows; track r.sno) {
              <tr class="border-b last:border-0">
                <td class="py-1.5 pr-4">{{ r.sno }}</td>
                <td class="py-1.5 pr-4">{{ r.name }}</td>
                <td class="py-1.5">{{ r.date }}</td>
              </tr>
            }
          </tbody>
        </table>
        <div class="mt-3 text-right">
          <a class="text-sm font-medium text-primary hover:underline">View All &rarr;</a>
        </div>
      </z-card-content>
    </z-card>
  `,
})
export class ReportsPanelComponent {
  protected readonly rows = [
    { sno: 1, name: 'Report 1', date: '10-01-17' },
    { sno: 2, name: 'Report 2', date: '10-01-17' },
    { sno: 3, name: 'Report 3', date: '10-01-17' },
  ];
}
