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
 * Auth / privilege models. The backend uses the (sic) spelling `previlegeObj` with
 * `serviceName` — the role/service filter keys on `serviceName === '1097'`. The nested
 * shape (service → roles → screen mappings) is what `userAuthenticate` returns and what
 * role-selection walks; everything is optional because deployments populate it unevenly.
 */
export interface ServiceRoleScreenMapping {
  screen?: { screenName?: string };
  providerServiceMapping?: {
    ctiCampaignName?: string;
    m_ServiceMaster?: { serviceID?: number };
  };
}

/** A role the user holds under a service (CO, Supervisor, …). */
export interface RolePrivilege {
  RoleID?: number;
  RoleName?: string;
  workingLocationID?: number;
  agentID?: number | string;
  serviceRoleScreenMappings?: ServiceRoleScreenMapping[];
}

/** A service the user is privileged for (filtered by `serviceName === '1097'`). */
export interface Privilege {
  serviceID?: number;
  serviceName?: string;
  roleID?: number;
  roleName?: string;
  apimanClientKey?: string;
  agentID?: number | string;
  roles?: RolePrivilege[];
}

export interface User {
  userID?: number | string;
  userName?: string;
  agentID?: number | string;
  loginIPAddress?: string;
  previlegeObj?: Privilege[];
}

/** Roles in Helpline1097. */
export type Role = 'CO' | 'Supervisor' | 'Admin';

/** This service line's privilege filter value. */
export const SERVICE_1097 = '1097';
