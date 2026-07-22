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

/** Angular's DatePipe coerced numeric STRINGS to epoch millis — `new Date()` does not. */
function toDate(value: number | string): Date {
  return new Date(typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value);
}

/** Old `millisToUTCDate(...) | date:'dd/MM/yyyy'` — format the UTC date parts. */
export function formatWorklistDate(value: number | string): string {
  const d = toDate(value);
  if (isNaN(d.getTime())) {
    return '';
  }
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** Old `lastCall | date:'dd/MM/yyyy hh:mm a'` — local-time render like the old pipe. */
export function formatWorklistDateTime(value: number | string): string {
  const d = toDate(value);
  if (isNaN(d.getTime())) {
    return '';
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  let hours = d.getHours();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hh = String(hours).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min} ${suffix}`;
}
