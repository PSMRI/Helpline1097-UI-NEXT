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
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleHelp, lucidePhone, lucidePower, lucideUser, lucideUserX } from '@ng-icons/lucide';
import { filter, map, startWith } from 'rxjs/operators';

import { menuImports } from '@common-ui/ui/menu';
import { ZardSelectImports } from '@common-ui/ui/select';
import { ZardDialogService } from '@common-ui/ui/dialog';

import { APP_VERSION } from '@/app-modules/core/app-version';
import { AuthService } from '@/app-modules/core/auth/auth.service';
import { ConfigService } from '@/app-modules/core/services/config.service';
import { CtiCallEventsService } from '@/app-modules/core/services/cti-call-events.service';
import { CtiService } from '@/app-modules/core/services/cti.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import {
  ENCRYPTED_KEYS,
  PLAIN_KEYS,
  SessionStorageService,
} from '@/app-modules/core/services/session-storage.service';
import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';
import { CallStore } from '@/app-modules/core/state/call.store';
import { LanguageStore } from '@/app-modules/core/state/language.store';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { UiStore } from '@/app-modules/core/state/ui.store';

import { EmergencyContactsDialogComponent } from './emergency-contacts-dialog.component';
import { ForceLogoutDialogComponent } from './force-logout-dialog.component';
import { VersionDialogComponent } from './version-dialog.component';

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
  imports: [RouterOutlet, NgIcon, TranslatePipe, ...ZardSelectImports, ...menuImports],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({ lucidePower, lucideUser, lucideCircleHelp, lucidePhone, lucideUserX }),
  ],
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly ctiEvents = inject(CtiCallEventsService);
  private readonly shellDestroyRef = inject(DestroyRef);

  constructor() {
    // Shell-wide CZentrix call-event listener (see CtiCallEventsService for why).
    this.ctiEvents.attach(this.shellDestroyRef);
    // Old multi-role-screen ngOnInit: fetch the language list, then load the persisted (or
    // default) language — i18n starts here, never on the login page.
    this.lang.init();

    // Old multi-role-screen back-button blocker: any browser-back inside the
    // authenticated shell is bounced forward (protects in-call state). Old attached it
    // via PlatformLocation.onPopState and leaked it past logout; scoping to the shell's
    // lifetime is the only deviation.
    const blockBack = () => window.history.forward();
    window.addEventListener('popstate', blockBack);
    this.shellDestroyRef.onDestroy(() => window.removeEventListener('popstate', blockBack));
  }
  private readonly cti = inject(CtiService);
  private readonly config = inject(ConfigService);
  private readonly dialog = inject(ZardDialogService);
  private readonly storage = inject(SessionStorageService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);
  private readonly notify = inject(NotificationService);
  protected readonly ui = inject(UiStore);

  protected readonly appVersion = APP_VERSION;

  protected readonly lang = inject(LanguageStore);

  /** Old dropdown iterated the backend `languageArray` by `languageName` — nothing hardcoded. */
  protected readonly languages = computed(() =>
    this.lang
      .languageList()
      .map((l) => l.languageName)
      .filter((n): n is string => !!n),
  );

  protected readonly userName = computed(() => this.sessionStore.user()?.userName ?? '');

  /** Old header's "ID: {agentId|userId}-{role}-{service}" identity line in the user menu. */
  protected readonly idRoleService = computed(() => {
    const id = this.sessionStore.agentId() ?? this.sessionStore.userId() ?? '';
    const role = this.sessionStore.currentRole() ?? '';
    const service = this.sessionStore.currentServiceName() ?? '';
    return `${id}-${role}-${service}`;
  });

  /** Merged `data` of the active child-route chain (title + flags like `showContacts`). */
  private readonly routeData = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let r = this.route.firstChild;
        let data: Record<string, unknown> = {};
        while (r) {
          if (r.snapshot?.data) {
            data = { ...data, ...r.snapshot.data };
          }
          r = r.firstChild;
        }
        return data;
      }),
    ),
    { initialValue: {} as Record<string, unknown> },
  );

  /** Page title from the active child route's `data.title` (e.g. "Select your role"). */
  protected readonly title = computed(() => (this.routeData()['title'] as string) ?? '');

  /**
   * Emergency-contacts + force-logout icons show only where the route opts in via
   * `data.showContacts` (old `showContacts`) — kept off the display title so it survives i18n.
   */
  protected readonly showContacts = computed(() => this.routeData()['showContacts'] === true);
  /** Force-logout is CO-only. */
  protected readonly isCO = computed(() => this.sessionStore.currentRole() === 'CO');

  /**
   * CZentrix softphone bar (old `multi-role-screen` iframe): CO agents only, and only when
   * the role carries an agent id. Supervisor never sees it (old `hideBar` flow).
   */
  protected readonly showCtiBar = computed(
    () => this.isCO() && this.sessionStore.agentId() != null,
  );
  /** Old `barMinimized` — the bar starts minimized; the footer button toggles it. */
  protected readonly barMinimized = signal(true);
  /** `{telephonyServerURL}bar/cti_handler.php?e={agentID}` (iframe logs into CZentrix itself). */
  protected readonly ctiHandlerUrl = computed(() =>
    this.config.trustedTelephonyUrl(`bar/cti_handler.php?e=${this.sessionStore.agentId()}`),
  );

  protected toggleBar(): void {
    this.barMinimized.set(!this.barMinimized());
  }

  /** Old selector `(change)="changeLanguage(app_language)"` — loads + persists + broadcasts. */
  protected onLanguageChange(value: string | string[]): void {
    const language = Array.isArray(value) ? (value[0] ?? '') : value;
    if (language) {
      this.lang.changeLanguage(language);
    }
  }

  /** Help → Version: UI vs API build info (old `viewVersionDetails`). */
  protected openVersion(): void {
    this.dialog.create({
      zTitle: 'Version',
      zContent: VersionDialogComponent,
      zOkText: null,
      zCancelText: 'Close',
    });
  }

  /** Help → License Info: opens the backend-served license page (old `licenseURL`). */
  protected openLicense(): void {
    window.open(`${this.config.openCommonBaseURL}license.html`, '_blank', 'noopener');
  }

  /** Emergency contacts (Dashboard only). */
  protected openEmergencyContacts(): void {
    this.dialog.create({
      zTitle: 'Emergency Contacts',
      zContent: EmergencyContactsDialogComponent,
      zOkText: null,
      zCancelText: 'Close',
      zWidth: '700px',
    });
  }

  /** Force-logout another agent (CO only). */
  protected openForceLogout(): void {
    this.dialog.create({
      zTitle: 'Force Logout',
      zContent: ForceLogoutDialogComponent,
      zOkText: null,
      zCancelText: 'Cancel',
      zWidth: '460px',
    });
  }

  /**
   * Logout — faithful to the old shell: CTI userLogout, clear call flags + apiman key +
   * language, reset stores, drop the token, then land on the public feedback page
   * (`/feedback?sl=1097`). The old logout deliberately LEFT `userID` in sessionStorage, so
   * that page can still offer identified feedback — kept.
   */
  protected logout(): void {
    // Old innerpage blocked CO logout during an active call (its own header replaced the
    // shell's mid-call; ours stays visible, so the check lives here).
    if (this.isCO() && this.storage.getItem(ENCRYPTED_KEYS.isOnCall) === 'yes') {
      this.notify.alert('Cannot logout during an active call.', 'warning');
      return;
    }
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
    // userID is deliberately NOT removed (old behavior) — /feedback reads it for the
    // identified-submission consent.
    this.storage.removeItem(ENCRYPTED_KEYS.setLanguage);
    this.storage.removeItem(ENCRYPTED_KEYS.currentRole);
    this.storage.removeItem(ENCRYPTED_KEYS.currentRoleId);
    this.ui.setLanguage('English');
    this.auth.removeToken();
    this.sessionStore.reset();
    this.callStore.reset();
    this.router.navigate(['/feedback'], { queryParams: { sl: '1097' } });
  }
}
