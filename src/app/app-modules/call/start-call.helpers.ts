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

import { ApiResponse, CallData, StartCallRequest } from '@/app-modules/core/models';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Build the common `call/startCall` request the old app assembled identically at every
 * call-open site (inbound registration, generic-outbound registration, grievance slide):
 * session/user/service bookkeeping fields, with per-flow `phoneNo`/`beneficiaryRegID`
 * overrides. The service adds the forced `is1097`/`isCalledEarlier` pair.
 */
export function buildStartCallRequest(
  sessionStore: SessionStore,
  callStore: CallStore,
  overrides: Pick<StartCallRequest, 'phoneNo' | 'beneficiaryRegID'>,
): StartCallRequest {
  return {
    callID: callStore.sessionId(),
    createdBy: sessionStore.user()?.userName,
    calledServiceID: sessionStore.currentServiceId() ?? undefined,
    agentID: sessionStore.agentId(),
    callReceivedUserID: sessionStore.userId(),
    receivedRoleName: sessionStore.currentRole() ?? undefined,
    isOutbound: callStore.isOutbound(),
    ...overrides,
  };
}

/** Old `saved_data.callData = response` — capture benCallID + the WHOLE call record. */
export function captureStartCallResponse(
  res: ApiResponse<CallData> | null | undefined,
  callStore: CallStore,
): void {
  if (res?.data?.benCallID != null) {
    callStore.benCallID.set(res.data.benCallID);
    callStore.callData.set(res.data as Record<string, unknown>);
  }
}
