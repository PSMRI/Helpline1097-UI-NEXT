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
import { DatePipe } from '@angular/common';

import { Z_MODAL_DATA } from '@common-ui/ui/dialog';

import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';

interface ConsolidatedRequest {
  feedbackRequestID?: number | string;
  feedbackSupSummary?: string;
  comments?: string;
  responseComments?: string;
  attachmentPath?: string;
  kmFileManager?: { fileName?: string };
  emailStatus?: { emailStatus?: string };
  createdBy?: string;
  createdDate?: number | string;
  responseUpdatedBy?: string;
  responseDate?: number | string;
}

/** Feedback row passed in as dialog data (old `modalData` mapped object). */
interface FeedbackStatusData {
  consolidatedRequests?: ConsolidatedRequest[];
  feedbackStatus?: { feedbackStatus?: string };
}

/**
 * Feedback request/response detail — Phase 6 port of the old `FeedbackStatusComponent`
 * dialog (opened from a feedback history-row click). Shows the consolidated request table;
 * dates render as the old app did (UTC wall-clock, dd/MM/yyyy hh:mm). Opened via
 * ZardDialogService with `zContent: FeedbackStatusDialogComponent` + `zData: <row>`.
 */
@Component({
  selector: 'app-feedback-status-dialog',
  imports: [DatePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-left text-xs uppercase text-muted-foreground">
            <th class="px-2 py-1.5 font-medium">{{ 'feedbackRequestId' | t }}</th>
            <th class="px-2 py-1.5 font-medium">{{ 'feedbackDescription' | t }}</th>
            <th class="px-2 py-1.5 font-medium">{{ 'supervisorComments' | t }}</th>
            <th class="px-2 py-1.5 font-medium">{{ 'responseReceived' | t }}</th>
            <th class="px-2 py-1.5 font-medium">{{ 'responseAttachment' | t }}</th>
            <th class="px-2 py-1.5 font-medium">{{ 'lastFeedbackStatus' | t }}</th>
            <th class="px-2 py-1.5 font-medium">{{ 'emailStatus' | t }}</th>
            <th class="px-2 py-1.5 font-medium">{{ 'forwardedBy' | t }}</th>
            <th class="px-2 py-1.5 font-medium">{{ 'forwardedDate' | t }}</th>
            <th class="px-2 py-1.5 font-medium">{{ 'updatedBy' | t }}</th>
            <th class="px-2 py-1.5 font-medium">{{ 'updatedDate' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows; track $index) {
            <tr class="border-b last:border-0 align-top">
              <td class="px-2 py-1.5">{{ r.feedbackRequestID }}</td>
              <td class="px-2 py-1.5">{{ r.feedbackSupSummary }}</td>
              <td class="px-2 py-1.5">{{ r.comments }}</td>
              <td class="px-2 py-1.5">{{ r.responseComments }}</td>
              <td class="px-2 py-1.5">
                @if (r.attachmentPath) {
                  <a
                    [href]="r.attachmentPath"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary hover:underline"
                  >{{ r.kmFileManager?.fileName || 'Attachment' }}</a>
                }
              </td>
              <td class="px-2 py-1.5">{{ statusName }}</td>
              <td class="px-2 py-1.5">{{ r.emailStatus?.emailStatus }}</td>
              <td class="px-2 py-1.5">{{ r.createdBy }}</td>
              <td class="px-2 py-1.5">{{ r.createdDate | date: 'dd/MM/yyyy hh:mm' : 'UTC' }}</td>
              <td class="px-2 py-1.5">{{ r.responseUpdatedBy }}</td>
              <td class="px-2 py-1.5">
                {{ r.responseDate ? (r.responseDate | date: 'dd/MM/yyyy hh:mm' : 'UTC') : '' }}
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="11" class="px-2 py-6 text-center text-muted-foreground">{{ 'noRecordsFound' | t }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class FeedbackStatusDialogComponent {
  private readonly data = inject<FeedbackStatusData>(Z_MODAL_DATA);

  protected readonly rows = this.data?.consolidatedRequests ?? [];
  protected readonly statusName = this.data?.feedbackStatus?.feedbackStatus ?? '';
}
