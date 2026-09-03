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

import { Routes } from '@angular/router';
import { authGuard, onCallGuard } from './app-modules/core/auth/auth.guard';
import { roleSelectedGuard, sessionHydrationGuard } from './app-modules/auth/guards/shell.guards';

/**
 * Auth routes use the OLD app's path strings verbatim (e.g. `resetPassword`,
 * `MultiRoleScreenComponent`) to stay behaviour-faithful.
 *
 * Guards mirror the old route table PER CHILD (as the old app did): role-selection/dashboard
 * carry AuthGuard, while the innerpage carries ONLY `onCallGuard` (old AuthGuard2) — AuthGuard
 * blocks navigation mid-call, so putting it on the shell's `canActivateChild` would break the
 * dashboard → innerpage jump when a call arrives.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./app-modules/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'resetPassword',
    loadComponent: () =>
      import('./app-modules/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'setPassword',
    loadComponent: () =>
      import('./app-modules/auth/set-password/set-password.component').then(
        (m) => m.SetPasswordComponent,
      ),
  },
  {
    // Public platform-feedback page (old `FeedbackPublicPageComponent`) — NO guard; the
    // logout flow lands here with ?sl=1097.
    path: 'feedback',
    loadComponent: () =>
      import('./app-modules/platform-feedback/feedback-public-page.component').then(
        (m) => m.FeedbackPublicPageComponent,
      ),
  },
  {
    path: 'setQuestions',
    loadComponent: () =>
      import('./app-modules/auth/set-security-questions/set-security-questions.component').then(
        (m) => m.SetSecurityQuestionsComponent,
      ),
  },
  {
    // Authenticated shell (old `MultiRoleScreenComponent`) hosting role-selection + dashboard.
    // The shell itself is unguarded (as in the old app); its children require auth.
    path: 'MultiRoleScreenComponent',
    loadComponent: () =>
      import('./app-modules/auth/shell/shell.component').then((m) => m.ShellComponent),
    // Re-hydrate the session on a full reload (token present, in-memory store empty).
    canActivate: [sessionHydrationGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./app-modules/auth/role-selection/role-selection.component').then(
            (m) => m.RoleSelectionComponent,
          ),
        canActivate: [authGuard],
        data: { title: 'Select your role' },
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./app-modules/auth/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
        // Dashboard needs a selected role; after a reload it's gone → back to role selection.
        canActivate: [authGuard, roleSelectedGuard],
        // `showContacts` gates the emergency-contacts / force-logout header icons,
        // read independently of the (later-localized) display title.
        data: { title: 'Dashboard', showContacts: true },
      },
      {
        // Old `RedirectToInnerpageComponent` — reachable only mid-call (old AuthGuard2).
        path: 'RedirectToInnerpageComponent',
        loadComponent: () =>
          import('./app-modules/call/innerpage/innerpage.component').then(
            (m) => m.InnerpageComponent,
          ),
        canActivate: [onCallGuard],
        data: { title: 'Call' },
      },
      {
        // Old `InnerpageComponent` — the Supervisor activity-area entry (same component,
        // role fork inside, exactly like the old dual-route setup). The old route carried
        // NO guard at all; a plain login check is kept here (declared deviation — the old
        // AuthGuard would have passed a supervisor anyway, and the guard makes no backend
        // call). NOT onCallGuard: a supervisor is never on a call.
        path: 'InnerpageComponent',
        loadComponent: () =>
          import('./app-modules/call/innerpage/innerpage.component').then(
            (m) => m.InnerpageComponent,
          ),
        canActivate: [authGuard, roleSelectedGuard],
        data: { title: 'Activity Area' },
      },
      {
        // Old `OutboundCallWorklistsComponent` — the CO's outbound dialing hub.
        path: 'OutboundCallWorklistsComponent',
        loadComponent: () =>
          import('./app-modules/outbound/outbound-worklists.component').then(
            (m) => m.OutboundWorklistsComponent,
          ),
        canActivate: [authGuard, roleSelectedGuard],
        data: { title: 'Outbound Worklist' },
      },
    ],
  },
];
