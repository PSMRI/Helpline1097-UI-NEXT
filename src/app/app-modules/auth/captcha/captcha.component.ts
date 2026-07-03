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

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';

import { ConfigService } from '@/app-modules/core/services/config.service';
import { CaptchaService } from '../services/captcha.service';

interface TurnstileApi {
  render(
    el: HTMLElement,
    options: { sitekey: string; theme?: string; callback?: (token: string) => void },
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}
declare const turnstile: TurnstileApi | undefined;

/**
 * Cloudflare Turnstile widget. Faithful port of the old `CaptchaComponent`: loads the
 * challenge script, renders the widget, emits the resolved token to the parent, and
 * exposes `reset()` so the login form can clear it after a failed attempt.
 */
@Component({
  selector: 'app-captcha',
  template: `<div #captchaContainer class="flex justify-center"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaptchaComponent implements AfterViewInit, OnDestroy {
  private readonly captchaService = inject(CaptchaService);
  private readonly config = inject(ConfigService);

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('captchaContainer');
  readonly tokenResolved = output<string>();

  private widgetId?: string;

  async ngAfterViewInit(): Promise<void> {
    try {
      await this.captchaService.loadScript();
    } catch {
      // Script failed to load — fail closed: no widget renders, so no token is emitted and
      // the login button stays disabled. Swallow to avoid an unhandled promise rejection.
      return;
    }
    if (typeof turnstile === 'undefined') {
      return;
    }
    this.widgetId = turnstile.render(this.container().nativeElement, {
      sitekey: this.config.siteKey,
      theme: 'light',
      callback: (token: string) => this.tokenResolved.emit(token),
    });
  }

  reset(): void {
    if (this.widgetId && typeof turnstile !== 'undefined') {
      turnstile.reset(this.widgetId);
    }
  }

  ngOnDestroy(): void {
    if (this.widgetId && typeof turnstile !== 'undefined') {
      turnstile.remove(this.widgetId);
    }
  }
}
