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

import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ZardLoaderComponent } from '@common-ui/ui/loader';
import { ZardToastComponent } from '@common-ui/ui/toast';
import { UiStore } from '@/app-modules/core/state/ui.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ZardLoaderComponent, ZardToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly ui = inject(UiStore);

  protected readonly toastOptions = {
    classes: {
      toast: 'rounded-lg border shadow-lg text-sm',
      title: 'font-medium',
      description: 'text-muted-foreground',
      closeButton: 'bg-background text-foreground border-border hover:bg-accent',
    },
  };

  constructor() {
    // Online/offline → UiStore (replaces the old AppComponent navigator.onLine wiring
    // that fed the HTTP wrappers' onlineFlag).
    this.ui.setOnline(navigator.onLine);
    window.addEventListener('online', () => this.ui.setOnline(true));
    window.addEventListener('offline', () => this.ui.setOnline(false));
  }
}
