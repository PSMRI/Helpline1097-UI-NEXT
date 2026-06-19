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

/**
 * Auth / privilege models. Fields are intentionally minimal for Phase 1 and will be
 * extended when the login flow is ported (Phase 3). The backend uses the (sic) spelling
 * `previlegeObj` with `serviceName` — the role/service filter keys on `serviceName === '1097'`.
 */
export interface Privilege {
  serviceID?: number;
  serviceName?: string;
  roleID?: number;
  roleName?: string;
}

export interface User {
  userID?: number | string;
  userName?: string;
  previlegeObj?: Privilege[];
}

/** Roles in Helpline1097. */
export type Role = 'CO' | 'Supervisor' | 'Admin';

/** This service line's privilege filter value. */
export const SERVICE_1097 = '1097';
