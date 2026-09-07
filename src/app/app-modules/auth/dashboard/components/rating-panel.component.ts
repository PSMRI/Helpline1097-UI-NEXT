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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideStar } from '@ng-icons/lucide';

import { cardImports } from '@common-ui/ui/card';

import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';

/**
 * Rating panel — a placeholder in the OLD app too (no live data wired). Kept as a
 * faithful placeholder until a real rating feature is migrated.
 */
@Component({
  selector: 'app-rating-panel',
  imports: [...cardImports, NgIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideStar })],
  template: `
    <z-card class="h-full shadow-sm transition-shadow hover:shadow-md">
      <z-card-header class="border-b pb-3">
        <z-card-title class="flex items-center gap-2 text-base font-semibold">
          <ng-icon name="lucideStar" class="text-lg text-primary" />
          {{ 'rating' | t }}
        </z-card-title>
      </z-card-header>
      <z-card-content class="pt-4">
        <p class="py-6 text-center text-sm text-muted-foreground">No ratings to display.</p>
      </z-card-content>
    </z-card>
  `,
})
export class RatingPanelComponent {}
