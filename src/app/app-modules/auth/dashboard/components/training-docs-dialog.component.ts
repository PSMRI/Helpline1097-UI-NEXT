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

import { Z_MODAL_DATA } from '@common-ui/ui/dialog';

/** One KM doc row (notification/getNotification response item). */
export interface KmDoc {
  notificationDesc?: string;
  kmFilePath?: string;
  [key: string]: unknown;
}

interface KmDocView extends KmDoc {
  urls: string[];
}

/**
 * Training-docs dialog (old `MessageDialogComponent`, its one WORKING caller contract —
 * `activity-this-week.openTrainingDialog` passing `kmdocs`; the old app's other callers
 * passed a different shape and would have thrown, and have no equivalents here).
 *
 * The description renders as PLAIN text; "linkification" is the old `checkForURL` extractor
 * producing a SEPARATE list of clickable links below it. The extractor's quirks are kept
 * verbatim: tokens split on space→comma→newline only; recognized only when they start with
 * www/WWW/http/HTTP/https/HTTPS AND end in .com/.co/.in/.org/.net/.int/.edu (anything else,
 * including trailing punctuation or other TLDs, is silently dropped); bare www gets
 * `https://` force-prepended.
 */
@Component({
  selector: 'app-training-docs-dialog',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex max-h-[60vh] flex-col gap-4 overflow-y-auto text-sm">
      @for (doc of docs(); track $index) {
        <div class="border-b border-border pb-3 last:border-b-0">
          <h4 class="font-semibold">{{ doc.notificationDesc }}</h4>
          @if (doc.kmFilePath) {
            <p class="mt-1">
              <a
                class="text-primary underline hover:text-primary/80"
                [href]="doc.kmFilePath"
                target="_blank"
                rel="noopener noreferrer"
                >Click here for more info</a
              >
            </p>
          }
          @if (doc.urls.length > 0) {
            <ul class="mt-1 flex flex-col gap-0.5">
              <li class="text-muted-foreground">
                {{ doc.urls.length > 1 ? 'Refer the links below' : 'Refer the link below' }}
              </li>
              @for (url of doc.urls; track $index) {
                <li>
                  <a
                    class="text-primary underline hover:text-primary/80"
                    [href]="url"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ url }}</a
                  >
                </li>
              }
            </ul>
          }
        </div>
      } @empty {
        <p class="text-muted-foreground">No records found</p>
      }
    </div>
  `,
})
export class TrainingDocsDialogComponent implements OnInit {
  private readonly data = inject<{ kmdocs: KmDoc[] }>(Z_MODAL_DATA);

  protected readonly docs = signal<KmDocView[]>([]);

  ngOnInit(): void {
    this.docs.set(
      (this.data?.kmdocs ?? []).map((doc) => ({
        ...doc,
        urls: checkForUrl(doc.notificationDesc ?? ''),
      })),
    );
  }
}

const TLDS = ['.com', '.co', '.in', '.org', '.net', '.int', '.edu'];

/** Old `checkForURL` — space→comma→newline tokenizer + prefix/TLD whitelist, verbatim. */
function checkForUrl(text: string): string[] {
  const result: string[] = [];
  for (const bySpace of text.split(' ')) {
    for (const byComma of bySpace.split(',')) {
      for (const token of byComma.split('\n')) {
        const upper = token.toUpperCase();
        const hasTld = TLDS.some((tld) => token.endsWith(tld));
        if (hasTld && (upper.startsWith('WWW') || upper.startsWith('HTTP'))) {
          result.push(token);
        }
      }
    }
  }
  return result.map((url) =>
    url.toUpperCase().startsWith('HTTP') ? url : `https://${url}`,
  );
}
