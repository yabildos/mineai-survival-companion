import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { defineAction } from "../action.js";
import {
  LOOK_AT,
  LOOK_AT_DESCRIPTION,
  lookAtAnnotations,
  lookAtInputSchema,
  lookAtResultSchema,
  parseLookAtRequest,
  type LookAtRequest,
  type LookAtResult,
} from "./contract.js";

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function position(point: { x: number; y: number; z: number }) {
  return { x: round(point.x, 2), y: round(point.y, 2), z: round(point.z, 2) };
}

async function lookAt(bot: Bot, request: LookAtRequest): Promise<LookAtResult> {
  if (request.target.kind === "position") {
    const target = new Vec3(request.target.x, request.target.y, request.target.z);
    await bot.lookAt(target, request.force);
    return {
      status: "succeeded",
      look: { target: request.target, yaw: round(bot.entity.yaw), pitch: round(bot.entity.pitch) },
    };
  }

  const entity = bot.entities[request.target.entityId];
  if (!entity?.isValid || !entity.position) {
    return {
      status: "failed",
      error: `[LOOK_ENTITY_UNAVAILABLE] Entity #${request.target.entityId} is not loaded.`,
      look: {
        target: { kind: "entity", entityId: request.target.entityId, name: "unknown", position: { x: 0, y: 0, z: 0 } },
        yaw: round(bot.entity.yaw),
        pitch: round(bot.entity.pitch),
      },
    };
  }
  const target = entity.position.offset(0, entity.height ? entity.height / 2 : 0, 0);
  await bot.lookAt(target, request.force);
  return {
    status: "succeeded",
    look: {
      target: { kind: "entity", entityId: entity.id, name: entity.name ?? "unknown", position: position(entity.position) },
      yaw: round(bot.entity.yaw),
      pitch: round(bot.entity.pitch),
    },
  };
}

export function formatLookAtResult(result: LookAtResult): string {
  const target = result.look.target.kind === "position"
    ? `${result.look.target.x}, ${result.look.target.y}, ${result.look.target.z}`
    : `#${result.look.target.entityId} ${result.look.target.name} at ${result.look.target.position.x}, ${result.look.target.position.y}, ${result.look.target.position.z}`;
  return `Looked at ${target}. Yaw ${result.look.yaw}, pitch ${result.look.pitch}.${result.status === "succeeded" ? "" : `\nObserved stop: ${result.error}`}`;
}

export function createLookAtAction(bot: Bot) {
  return defineAction({
    name: LOOK_AT,
    description: LOOK_AT_DESCRIPTION,
    inputSchema: lookAtInputSchema,
    resultSchema: lookAtResultSchema,
    formatResult: formatLookAtResult,
    execution: { kind: "task" },
    annotations: lookAtAnnotations,
    parse: parseLookAtRequest,
    execute: (request) => lookAt(bot, request),
  });
}

