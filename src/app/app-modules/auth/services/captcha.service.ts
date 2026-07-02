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

import { inject, Injectable } from '@angular/core';
import { ConfigService } from '@/app-modules/core/services/config.service';

/**
 * Loads the Cloudflare Turnstile challenge script on demand (once). Faithful port of the
 * old `CaptchaService` — the script URL comes from `environment.captchaChallengeURL`.
 */
@Injectable({ providedIn: 'root' })
export class CaptchaService {
  private readonly config = inject(ConfigService);
  private scriptLoaded = false;
  /** The in-flight load, reused so concurrent callers don't append duplicate scripts. */
  private loadPromise: Promise<void> | null = null;

  loadScript(): Promise<void> {
    if (this.scriptLoaded) {
      return Promise.resolve();
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this.config.captchaChallengeURL;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.scriptLoaded = true;
        this.loadPromise = null;
        resolve();
      };
      script.onerror = () => {
        this.scriptLoaded = false;
        this.loadPromise = null;
        script.remove();
        reject(new Error('Failed to load the captcha challenge script.'));
      };
      document.head.appendChild(script);
    });
    return this.loadPromise;
  }
}
