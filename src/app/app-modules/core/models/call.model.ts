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

/** One call type inside a group (from `call/getCallTypesV1`). */
export interface CallType {
  callTypeID?: number;
  callType?: string;
  callTypeDesc?: string;
}

/** A call-type group (`call/getCallTypesV1` returns an array of these). */
export interface CallTypeGroup {
  callGroupType?: string;
  callTypes?: CallType[];
}

/**
 * `call/closeCall` request body — field set and semantics are byte-faithful to the old
 * innerpage `closeCall()` (all fields optional because the old app sent `undefined` for
 * some, e.g. `prefferedDateTime`; the misspelling is the backend contract).
 */
export interface CloseCallRequest {
  benCallID?: number | string;
  /** String on the normal paths; the old wrap-up auto-close sent the RAW numeric id. */
  callTypeID?: string | number | null;
  fitToBlock?: string;
  isFollowupRequired?: boolean;
  prefferedDateTime?: string;
  endCall?: boolean;
  isCompleted?: boolean;
  callType?: string;
  beneficiaryRegID?: number | string | null;
  remarks?: string | null;
  providerServiceMapID?: number;
  createdBy?: string;
  agentID?: number | string | null;
  agentIPAddress?: string;
}

/** `user/role/{roleID}` response data — role-based wrap-up configuration. */
export interface RoleWrapupTimeData {
  isWrapUpTime?: boolean;
  WrapUpTime?: number;
}
