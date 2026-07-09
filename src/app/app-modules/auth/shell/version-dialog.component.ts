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

import { APP_VERSION } from '@/app-modules/core/app-version';
import { AppInfoService } from '@/app-modules/core/services/app-info.service';

/**
 * Help → Version dialog. Shows the UI build version alongside the API's git build info
 * (fetched from the `version` endpoint), matching the old `ViewVersionDetailsComponent`.
 * Opened via ZardDialogService with `zContent: VersionDialogComponent`.
 */
@Component({
  selector: 'app-version-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b text-left text-muted-foreground">
          <th class="py-1.5 pr-4 font-medium"></th>
          <th class="py-1.5 pr-4 font-medium">Version</th>
          <th class="py-1.5 font-medium">Commit</th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-b">
          <td class="py-1.5 pr-4 font-medium">UI</td>
          <td class="py-1.5 pr-4">{{ uiVersion }}</td>
          <td class="py-1.5 text-muted-foreground">—</td>
        </tr>
        <tr>
          <td class="py-1.5 pr-4 font-medium">API</td>
          <td class="py-1.5 pr-4">{{ apiVersion() }}</td>
          <td class="py-1.5">{{ apiCommit() }}</td>
        </tr>
      </tbody>
    </table>
  `,
})
export class VersionDialogComponent implements OnInit {
  private readonly appInfo = inject(AppInfoService);

  protected readonly uiVersion = APP_VERSION;
  protected readonly apiVersion = signal('…');
  protected readonly apiCommit = signal('…');

  ngOnInit(): void {
    this.appInfo.getApiVersionDetails().subscribe({
      next: (res) => {
        this.apiVersion.set(res?.data?.['git.build.version'] ?? 'unknown');
        this.apiCommit.set(res?.data?.['git.commit.id'] ?? 'unknown');
      },
      error: () => {
        this.apiVersion.set('unavailable');
        this.apiCommit.set('unavailable');
      },
    });
  }
}
