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
import { authGuard } from './app-modules/core/auth/auth.guard';

/**
 * Auth routes use the OLD app's path strings verbatim (e.g. `resetPassword`,
 * `MultiRoleScreenComponent`) to stay behaviour-faithful.
 *
 * Guards mirror the old route table: in the old app the `MultiRoleScreenComponent` parent
 * was unguarded and its children (role-selection, dashboard) carried AuthGuard. We replicate
 * that with `canActivateChild: [authGuard]` on the shell. `onCallGuard` (old AuthGuard2)
 * guards the call/innerpage screens, which are migrated in a later phase — nothing uses it yet.
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
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./app-modules/auth/role-selection/role-selection.component').then(
            (m) => m.RoleSelectionComponent,
          ),
        data: { title: 'Select your role' },
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./app-modules/auth/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
        data: { title: 'Dashboard' },
      },
    ],
  },
];
