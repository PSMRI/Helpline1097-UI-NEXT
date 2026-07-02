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
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePower } from '@ng-icons/lucide';
import { filter, map, startWith } from 'rxjs/operators';

import { ZardSelectImports } from '@common-ui/ui/select';

import { AuthService } from '@/app-modules/core/auth/auth.service';
import { CtiService } from '@/app-modules/core/services/cti.service';
import {
  ENCRYPTED_KEYS,
  PLAIN_KEYS,
  SessionStorageService,
} from '@/app-modules/core/services/session-storage.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { UiStore } from '@/app-modules/core/state/ui.store';

/** App version shown in the footer. TODO: source from package.json when versioning is set up. */
const APP_VERSION = '0.0.0';

/**
 * Authenticated shell — minimal port of the old `MultiRoleScreenComponent`: a blue header
 * (logo + AMRIT, centered page title, language selector, "Welcome <user>", logout) and a
 * dark footer (version), hosting the role-selection / dashboard child routes.
 *
 * Deferred to later phases (NOT in this minimal shell): the CTI/CZentrix iframe bar,
 * emergency-contacts / force-logout / help-version menus, and the real dashboard content.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, NgIcon, ...ZardSelectImports],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucidePower })],
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly cti = inject(CtiService);
  private readonly storage = inject(SessionStorageService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);
  protected readonly ui = inject(UiStore);

  protected readonly appVersion = APP_VERSION;

  // Language selector is display-only for now (persists the choice); the backend-driven
  // language list + actual i18n translation arrive in a later phase.
  protected readonly languages = ['English', 'Hindi', 'Assamese'];

  protected readonly userName = computed(() => this.sessionStore.user()?.userName ?? '');

  /** Page title from the active child route's `data.title` (e.g. "Select your role"). */
  protected readonly title = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let r = this.route.firstChild;
        let title = '';
        while (r) {
          const t = r.snapshot?.data?.['title'];
          if (t) {
            title = t as string;
          }
          r = r.firstChild;
        }
        return title;
      }),
    ),
    { initialValue: '' },
  );

  protected onLanguageChange(value: string | string[]): void {
    this.ui.setLanguage(Array.isArray(value) ? (value[0] ?? '') : value);
  }

  /**
   * Logout — faithful to the old shell: CTI userLogout, clear call flags + apiman key +
   * language, reset stores, drop the token, then back to login.
   * (Old app navigated to /feedback?sl=1097; that route isn't migrated yet — TODO restore.)
   */
  protected logout(): void {
    this.cti.userLogout().subscribe({
      next: () => this.finishLogout(),
      error: () => this.finishLogout(),
    });
  }

  private finishLogout(): void {
    this.storage.removeItem(ENCRYPTED_KEYS.isOnCall);
    this.storage.removeItem(ENCRYPTED_KEYS.isEverwellCall);
    this.storage.removeItem(ENCRYPTED_KEYS.isGrievanceCall);
    this.storage.removeItem(PLAIN_KEYS.apimanKey);
    this.storage.removeItem(PLAIN_KEYS.userId);
    this.storage.removeItem(ENCRYPTED_KEYS.setLanguage);
    this.ui.setLanguage('English');
    this.auth.removeToken();
    this.sessionStore.reset();
    this.callStore.reset();
    this.router.navigate(['']);
  }
}
