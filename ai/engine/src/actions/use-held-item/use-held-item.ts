import type { Bot } from "mineflayer";
import { defineAction } from "../action.js";
import {
  USE_HELD_ITEM,
  USE_HELD_ITEM_DESCRIPTION,
  parseUseHeldItemRequest,
  useHeldItemAnnotations,
  useHeldItemInputSchema,
  useHeldItemResultSchema,
  type UseHeldItemRequest,
  type UseHeldItemResult,
} from "./contract.js";

function itemName(bot: Bot, hand: "hand" | "off-hand"): string | null {
  if (hand === "hand") return bot.heldItem?.name ?? null;
  return bot.inventory.slots[45]?.name ?? null;
}

async function run(bot: Bot, request: UseHeldItemRequest, signal?: AbortSignal): Promise<UseHeldItemResult> {
  const itemBefore = itemName(bot, request.hand);
  const usingBefore = bot.usingHeldItem === true;
  if (request.operation === "stop") {
    bot.deactivateItem();
    return {
      status: "succeeded",
      use: {
        operation: request.operation,
        hand: request.hand,
        itemBefore,
        itemAfter: itemName(bot, request.hand),
        usingBefore,
        usingAfter: bot.usingHeldItem === true,
        heldTicks: 0,
      },
    };
  }

  bot.activateItem(request.hand === "off-hand");
  let heldTicks = 0;
  for (; heldTicks < request.hold_ticks; heldTicks += 1) {
    signal?.throwIfAborted();
    await bot.waitForTicks(1);
  }
  signal?.throwIfAborted();
  return {
    status: "succeeded",
    use: {
      operation: request.operation,
      hand: request.hand,
      itemBefore,
      itemAfter: itemName(bot, request.hand),
      usingBefore,
      usingAfter: bot.usingHeldItem === true,
      heldTicks,
    },
  };
}

export function formatUseHeldItemResult(result: UseHeldItemResult): string {
  const { use } = result;
  return `${use.operation === "start" ? "Started using" : "Stopped using"} ${use.hand} item ${use.itemBefore ?? "nothing"}. Using before: ${use.usingBefore ? "yes" : "no"}; after: ${use.usingAfter ? "yes" : "no"}; held ${use.heldTicks} ticks.`;
}

export function createUseHeldItemAction(bot: Bot) {
  return defineAction({
    name: USE_HELD_ITEM,
    description: USE_HELD_ITEM_DESCRIPTION,
    inputSchema: useHeldItemInputSchema,
    resultSchema: useHeldItemResultSchema,
    formatResult: formatUseHeldItemResult,
    execution: { kind: "task" },
    annotations: useHeldItemAnnotations,
    parse: parseUseHeldItemRequest,
    execute: (request, context) => run(bot, request, context.signal),
  });
}

