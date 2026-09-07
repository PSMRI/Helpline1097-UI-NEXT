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

import { inject, Pipe, PipeTransform } from '@angular/core';

import { LanguageStore } from '../state/language.store';

/**
 * `{{ 'key' | t }}` — the old `{{ currentLanguageSet?.key }}` binding. Missing key (or no
 * language loaded yet) renders '' exactly as the old optional-chain did.
 *
 * DELIBERATELY `pure: false`: a pure pipe memoizes on its (unchanged) key string and would
 * keep serving the previous language after a switch. Impure keeps the transform running on
 * each refresh, and the signal read inside it keeps the view subscribed to language changes.
 * The cost is a hash lookup per binding per refresh — negligible.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly lang = inject(LanguageStore);

  transform(key: string): string {
    return this.lang.t(key);
  }
}
