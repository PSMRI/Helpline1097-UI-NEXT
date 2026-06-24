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

import { computed, Injectable, signal } from '@angular/core';

/**
 * App-wide UI state (signals): global loader, online/offline, and current language.
 * Replaces the old loader.service / reload / listner Subjects.
 */
@Injectable({ providedIn: 'root' })
export class UiStore {
  // Loader is ref-counted so overlapping HTTP calls don't hide it prematurely.
  private readonly pending = signal(0);
  readonly loading = computed(() => this.pending() > 0);

  showLoader(): void {
    this.pending.update((n) => n + 1);
  }

  hideLoader(): void {
    this.pending.update((n) => Math.max(0, n - 1));
  }

  // Online/offline — initialized from the browser's current connectivity (SSR-safe guard),
  // then kept in sync by the AppComponent (navigator.onLine + online/offline events).
  readonly online = signal(typeof navigator !== 'undefined' ? navigator.onLine : true);
  setOnline(value: boolean): void {
    this.online.set(value);
  }

  // Current UI language (default matches the old dataService.appLanguage).
  readonly language = signal<string>('English');
  setLanguage(value: string): void {
    this.language.set(value);
  }
}
