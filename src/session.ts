/**
 * Session identity + outgoing request headers for the Aigency API.
 *
 * The CLI is a FIRST-PARTY client of the shopping API, so it identifies itself
 * on every request:
 *   - a stable per-launch session id groups all of a run's searches + the
 *     click-through into ONE session in the portal (instead of N orphan rows);
 *   - a User-Agent / X-Agent-Name / X-Channel let the server log the traffic as
 *     "Aigency CLI" rather than "Unknown".
 *
 * newSessionId() uses crypto.randomUUID(); aigencyHeaders() is a pure function
 * of its input, so the header shape is trivially unit-testable.
 */

import { randomUUID } from "node:crypto";

/** CLI version sent in the User-Agent. Keep in lockstep with package.json. */
export const CLI_VERSION = "0.2.0";

/** utm_source / attribution tag stamped on click-through events. */
export const UTM_SOURCE = "aigency-cli";

/** Mint a fresh session id for one CLI run. Prefixed so it's greppable in logs. */
export function newSessionId(): string {
  return `cli-${randomUUID()}`;
}

/**
 * Headers sent on every API request so the server can attribute the traffic.
 * `X-Agent-Name: Aigency CLI` and the `aigency-cli/<v>` User-Agent both resolve
 * to agentName/agentType "Aigency CLI" server-side; `X-Channel: cli` tags the
 * channel; `X-Session-Id` groups the whole run into one session.
 */
export function aigencyHeaders(sessionId: string): Record<string, string> {
  return {
    Accept: "application/json",
    "User-Agent": `aigency-cli/${CLI_VERSION}`,
    "X-Agent-Name": "Aigency CLI",
    "X-Channel": "cli",
    "X-Session-Id": sessionId,
  };
}
