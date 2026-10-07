import type { Bot } from "mineflayer";
import { defineAction } from "../action.js";
import {
  ACTIVATE_ENTITY,
  ACTIVATE_ENTITY_DESCRIPTION,
  activateEntityAnnotations,
  activateEntityInputSchema,
  activateEntityOutcomes,
  activateEntityResultSchema,
  parseActivateEntityRequest,
  type ActivateEntityRequest,
  type ActivateEntityResult,
} from "./contract.js";

const ENTITY_REACH = 4.5;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function evidence(bot: Bot, request: ActivateEntityRequest, activated: boolean): ActivateEntityResult["interaction"] {
  const entity = bot.entities[request.entityId];
  return {
    entityId: request.entityId,
    name: entity?.name ?? "unknown",
    distance: entity?.position ? round(entity.position.distanceTo(bot.entity.position)) : null,
    activated,
  };
}

async function activate(bot: Bot, request: ActivateEntityRequest): Promise<ActivateEntityResult> {
  const entity = bot.entities[request.entityId];
  if (!entity?.isValid || !entity.position) {
    return { status: "failed", error: activateEntityOutcomes.unavailable(request.entityId), interaction: evidence(bot, request, false) };
  }
  const distance = entity.position.distanceTo(bot.entity.position);
  if (distance > ENTITY_REACH) {
    return { status: "failed", error: activateEntityOutcomes.outOfReach(request.entityId, distance), interaction: evidence(bot, request, false) };
  }
  try {
    await bot.activateEntity(entity);
    return { status: "succeeded", interaction: evidence(bot, request, true) };
  } catch (cause) {
    return { status: "failed", error: activateEntityOutcomes.failed(cause), interaction: evidence(bot, request, false) };
  }
}

export function formatActivateEntityResult(result: ActivateEntityResult): string {
  const { interaction } = result;
  return `${interaction.activated ? "Activated" : "Did not activate"} entity #${interaction.entityId} ${interaction.name}${interaction.distance === null ? "" : ` at ${interaction.distance} blocks`}.${result.status === "succeeded" ? "" : `\nObserved stop: ${result.error}`}`;
}

export function createActivateEntityAction(bot: Bot) {
  return defineAction({
    name: ACTIVATE_ENTITY,
    description: ACTIVATE_ENTITY_DESCRIPTION,
    inputSchema: activateEntityInputSchema,
    resultSchema: activateEntityResultSchema,
    formatResult: formatActivateEntityResult,
    execution: { kind: "task" },
    annotations: activateEntityAnnotations,
    parse: parseActivateEntityRequest,
    execute: (request) => activate(bot, request),
  });
}

