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

import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';

import { LanguageService } from '../services/language.service';
import { NotificationService } from '../services/notification.service';
import { ENCRYPTED_KEYS, SessionStorageService } from '../services/session-storage.service';
import { UiStore } from './ui.store';

/** `beneficiary/getLanguageList` row (the old `languageArray` items). */
export interface LanguageRow {
  languageID?: number;
  languageName?: string;
  [key: string]: unknown;
}

/**
 * Runtime i18n (old `HttpServices.currentLangugae$` + the multi-role-screen handlers), as
 * signals. The mechanism is the old app's, verbatim:
 *
 *  - the selectable languages come from `beneficiary/getLanguageList`;
 *  - a language is a flat key→string map loaded from `./assets/<language>.json`, whose file is
 *    keyed BY the language name (`{ "English": { ... } }` — `file[language]` is the set);
 *  - the chosen name persists in AES sessionStorage under `setLanguage` and re-applies on the
 *    next shell mount, else the `UiStore.language` default ("English") is loaded;
 *  - screens read the CURRENT set only — a missing key renders as an empty string, exactly
 *    like the old `{{ currentLanguageSet?.key }}` bindings (several old keys were genuinely
 *    absent and rendered blank).
 *
 * Nothing loads until the post-login shell calls `init()` — the old app had no i18n on the
 * login page, and neither does this one.
 */
@Injectable({ providedIn: 'root' })
export class LanguageStore {
  private readonly http = inject(HttpClient);
  private readonly languageApi = inject(LanguageService);
  private readonly storage = inject(SessionStorageService);
  private readonly ui = inject(UiStore);
  private readonly notify = inject(NotificationService);

  /** Old `languageArray` — drives the header dropdown. */
  readonly languageList = signal<LanguageRow[]>([]);
  /** Old `currentLanguageSet` / the `currentLangugae$` BehaviorSubject payload. */
  readonly currentLanguageSet = signal<Record<string, string> | null>(null);

  /**
   * Old multi-role-screen `ngOnInit` → `fetchLanguageSet()` → `getLanguage()`. Runs on every
   * shell mount (login → shell), like the old component did. A failed list fetch loaded no
   * language at all in the old app (its subscribe had no error path) — kept.
   */
  init(): void {
    this.languageApi.getLanguageList().subscribe({
      next: (rows) => {
        this.languageList.set((rows as LanguageRow[]) ?? []);
        const persisted = this.storage.getItem(ENCRYPTED_KEYS.setLanguage);
        this.changeLanguage(persisted ?? this.ui.language());
      },
      error: () => {
        // Old `fetchLanguageSet().subscribe(next)` had no error handler: the list stayed
        // empty and no language was loaded.
      },
    });
  }

  /** Old `changeLanguage` + `languageSuccessHandler`, alerts included verbatim. */
  changeLanguage(language: string): void {
    this.http.get<Record<string, Record<string, string>> | null>(`./assets/${language}.json`).subscribe({
      next: (file) => {
        if (!file) {
          this.notify.alert('Language not defined', 'error');
          return;
        }
        const set = file[language];
        this.currentLanguageSet.set(set ?? null);
        this.storage.setItem(ENCRYPTED_KEYS.setLanguage, language);
        // Old quirk kept: with a loaded set, `appLanguage` updates only when the name exists
        // in the backend list; with a missing set it updates unconditionally.
        if (set) {
          if (this.languageList().some((l) => l.languageName === language)) {
            this.ui.setLanguage(language);
          }
        } else {
          this.ui.setLanguage(language);
        }
      },
      error: () => {
        // Old message concatenated with an EMPTY string (no space before the name) — kept.
        this.notify.alert('We are coming up with this language' + '' + language, 'info');
      },
    });
  }

  /**
   * Translate a key against the current set. Missing key (or nothing loaded yet) yields ''
   * — the old `{{ currentLanguageSet?.key }}` semantics.
   */
  t(key: string): string {
    return this.currentLanguageSet()?.[key] ?? '';
  }
}
