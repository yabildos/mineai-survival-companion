import type { Bot } from "mineflayer";
import { defineAction } from "../action.js";
import {
  INSPECT_VILLAGER,
  INSPECT_VILLAGER_DESCRIPTION,
  inspectVillagerAnnotations,
  inspectVillagerInputSchema,
  inspectVillagerResultSchema,
  parseInspectVillagerRequest,
  type InspectVillagerRequest,
  type InspectVillagerResult,
} from "./contract.js";

function item(value: { name: string; count: number } | null | undefined) {
  return value ? { name: value.name, count: value.count } : null;
}

async function run(bot: Bot, request: InspectVillagerRequest): Promise<InspectVillagerResult> {
  const entity = bot.entities[request.entity_id];
  const distance = entity?.position ? bot.entity.position.distanceTo(entity.position) : Number.POSITIVE_INFINITY;
  const base = { entityId: request.entity_id, distance: Number.isFinite(distance) ? Number(distance.toFixed(2)) : -1, offers: [], closed: bot.currentWindow === null };
  if (!entity || entity.name !== "villager") return { status: "failed", error: "[NO_VILLAGER] The requested villager is not loaded.", villager: base };
  if (distance > 4.5) return { status: "failed", error: "[VILLAGER_OUT_OF_REACH] Move closer before inspecting trades.", villager: base };
  let window: Awaited<ReturnType<Bot["openVillager"]>> | null = null;
  try {
    window = await bot.openVillager(entity);
    const offers = window.trades.map((offer, index) => ({
      index,
      input1: { name: offer.inputItem1.name, count: offer.inputItem1.count },
      input2: offer.hasItem2 ? item(offer.inputItem2)! : null,
      output: { name: offer.outputItem.name, count: offer.outputItem.count },
      disabled: Boolean(offer.tradeDisabled),
      realPrice: typeof offer.realPrice === "number" ? offer.realPrice : null,
    }));
    window.close();
    return { status: "succeeded", villager: { entityId: request.entity_id, distance: Number(distance.toFixed(2)), offers, closed: bot.currentWindow === null } };
  } catch (cause) {
    if (window) window.close();
    return { status: "failed", error: `[VILLAGER_OPEN_FAILED] ${cause instanceof Error ? cause.message : String(cause)}`, villager: { ...base, closed: bot.currentWindow === null } };
  }
}

export function formatInspectVillagerResult(result: InspectVillagerResult): string {
  const lines = [`Villager #${result.villager.entityId}: ${result.status}; ${result.villager.offers.length} offer(s), distance ${result.villager.distance}.`];
  for (const offer of result.villager.offers) {
    const second = offer.input2 ? ` + ${offer.input2.count} ${offer.input2.name}` : "";
    lines.push(`- ${offer.index}: ${offer.realPrice ?? offer.input1.count} ${offer.input1.name}${second} -> ${offer.output.count} ${offer.output.name}${offer.disabled ? " [disabled]" : ""}`);
  }
  if (result.status !== "succeeded") lines.push(`Observed stop: ${result.error}`);
  return lines.join("\n");
}

export function createInspectVillagerAction(bot: Bot) {
  return defineAction({
    name: INSPECT_VILLAGER,
    description: INSPECT_VILLAGER_DESCRIPTION,
    inputSchema: inspectVillagerInputSchema,
    resultSchema: inspectVillagerResultSchema,
    formatResult: formatInspectVillagerResult,
    execution: { kind: "information" },
    annotations: inspectVillagerAnnotations,
    parse: parseInspectVillagerRequest,
    execute: (request) => run(bot, request),
  });
}
