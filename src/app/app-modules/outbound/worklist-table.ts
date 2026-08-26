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

import { computed, signal } from '@angular/core';

/** Extracts a comparable value from a row for a sortable column. */
export type SortAccessor<T> = (row: T) => string | number | null | undefined;

/**
 * Client-side sort + pagination state for the outbound worklist tables — reproduces the old
 * md2DataTable behaviour (`[rowsPerPage]="4"`, `md2SortBy` sortable columns, and the
 * `(activePage-1)*rowsPerPage + i + 1` serial number). Signal-based so it drives OnPush
 * templates directly; one instance per table.
 */
export class WorklistTable<T> {
  private readonly source = signal<T[]>([]);
  private accessors: Record<string, SortAccessor<T>> = {};

  readonly pageSize: number;
  readonly pageIndex = signal(0);
  readonly sortKey = signal<string | null>(null);
  readonly sortDir = signal<1 | -1>(1);

  constructor(pageSize = 4) {
    this.pageSize = pageSize;
  }

  /** Column-key → value accessor for the sortable columns. */
  setAccessors(accessors: Record<string, SortAccessor<T>>): void {
    this.accessors = accessors;
  }

  /** Replace the row set (e.g. after a fetch or a search-filter) and reset to page 0. */
  setRows(rows: T[]): void {
    this.source.set(rows);
    this.pageIndex.set(0);
  }

  /** The full (sorted) set — used for the "Total Count" display. */
  readonly sorted = computed<T[]>(() => {
    const key = this.sortKey();
    const rows = this.source();
    const accessor = key ? this.accessors[key] : undefined;
    if (!accessor) {
      return rows;
    }
    const dir = this.sortDir();
    return [...rows].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls last, regardless of direction
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  });

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.sorted().length / this.pageSize)));

  /** The current page's rows. */
  readonly paged = computed<T[]>(() => {
    const start = this.pageIndex() * this.pageSize;
    return this.sorted().slice(start, start + this.pageSize);
  });

  /** Toggle sort on a column key (first click = ascending, second = descending). */
  toggleSort(key: string): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 1 ? -1 : 1));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(1);
    }
    this.pageIndex.set(0);
  }

  /** '▲' / '▼' when this column is the active sort, else ''. */
  sortIndicator(key: string): string {
    if (this.sortKey() !== key) {
      return '';
    }
    return this.sortDir() === 1 ? '▲' : '▼';
  }

  /** Old serial number: 1-based, continuous across pages. */
  serial(indexOnPage: number): number {
    return this.pageIndex() * this.pageSize + indexOnPage + 1;
  }

  prev(): void {
    this.pageIndex.update((p) => Math.max(0, p - 1));
  }

  next(): void {
    this.pageIndex.update((p) => Math.min(this.pageCount() - 1, p + 1));
  }
}
