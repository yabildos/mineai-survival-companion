import type { NavigationRuntime } from "../../navigation/index.js";
import { defineAction } from "../action.js";
import {
  GET_PATHFINDER_STATUS,
  GET_PATHFINDER_STATUS_DESCRIPTION,
  getPathfinderStatusAnnotations,
  getPathfinderStatusInputSchema,
  getPathfinderStatusResultSchema,
  parseGetPathfinderStatusRequest,
  type GetPathfinderStatusResult,
} from "./contract.js";

export function formatGetPathfinderStatusResult(result: GetPathfinderStatusResult): string {
  const status = result.pathfinder.status;
  return status === null
    ? `Pathfinder active: ${result.pathfinder.active}; no active route. Dive backstop: ${result.pathfinder.diveBackstop ?? "none"}.`
    : `Pathfinder active: ${result.pathfinder.active}; status: ${JSON.stringify(status)}. Dive backstop: ${result.pathfinder.diveBackstop ?? "none"}.`;
}

export function createGetPathfinderStatusAction(navigation: NavigationRuntime) {
  return defineAction({
    name: GET_PATHFINDER_STATUS,
    description: GET_PATHFINDER_STATUS_DESCRIPTION,
    inputSchema: getPathfinderStatusInputSchema,
    resultSchema: getPathfinderStatusResultSchema,
    formatResult: formatGetPathfinderStatusResult,
    execution: { kind: "information" },
    annotations: getPathfinderStatusAnnotations,
    parse: parseGetPathfinderStatusRequest,
    execute: async () => ({
      status: "succeeded",
      pathfinder: { active: navigation.active, status: navigation.status, diveBackstop: navigation.diveBackstop?.() ?? null },
    }),
  });
}
