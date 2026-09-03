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

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';

import { FeedbackDialogComponent } from './feedback-dialog.component';
import { ServiceLine } from './feedback-api.service';

/**
 * Public feedback page (old `FeedbackPublicPageComponent`, route `/feedback`, NO auth) —
 * the post-logout landing page. The service line comes from `?sl=`, else is sniffed from
 * the URL path (each service line deploys under its own base path), falling back to "AAM"
 * — with the old's own "104" default before the query param resolves.
 */
@Component({
  selector: 'app-feedback-public-page',
  imports: [FeedbackDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <app-feedback-dialog [serviceLine]="serviceLine()" defaultCategorySlug="general-feedback" />
    </div>
  `,
})
export class FeedbackPublicPageComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly slParam = toSignal(
    this.route.queryParamMap.pipe(map((q) => q.get('sl') as ServiceLine | null)),
    { initialValue: null },
  );

  protected readonly serviceLine = computed<ServiceLine>(
    // || not ??: /feedback?sl= yields an EMPTY string, which the old code fell through on.
    () => this.slParam() || detectFromLocation(),
  );
}

/** Old `detectFromLocation` — path-based service-line sniffing, fallback AAM. */
function detectFromLocation(): ServiceLine {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('/1097')) return '1097';
  if (path.includes('/104')) return '104';
  if (path.includes('/aam')) return 'AAM';
  if (path.includes('/mmu')) return 'MMU';
  if (path.includes('/tm')) return 'TM';
  if (path.includes('/ecd')) return 'ECD';
  return 'AAM';
}
