import type { Bot } from "mineflayer";
import { defineAction, type ActionContext } from "../action.js";
import { equipmentSlots } from "../equip/equip.js";
import {
  UNEQUIP,
  UNEQUIP_DESCRIPTION,
  parseUnequipRequest,
  unequipAnnotations,
  unequipInputSchema,
  unequipOutcomes,
  unequipResultSchema,
  type UnequipRequest,
  type UnequipResult,
} from "./contract.js";
import type { EquipmentDestination } from "../equip/contract.js";

function equippedName(bot: Bot, destination: EquipmentDestination): string | null {
  if (destination === "hand") return bot.heldItem?.name ?? null;
  return bot.inventory.slots[bot.getEquipmentDestSlot(destination)]?.name ?? null;
}

export async function unequip(bot: Bot, request: UnequipRequest, context: ActionContext): Promise<UnequipResult> {
  const cleared: UnequipResult["unequip"]["cleared"] = [];
  for (const destination of request.destinations) {
    context.signal?.throwIfAborted();
    const itemBefore = equippedName(bot, destination);
    if (itemBefore === null) {
      cleared.push({ destination, itemBefore, cleared: true });
      continue;
    }
    try {
      await bot.unequip(destination);
    } catch (cause) {
      context.signal?.throwIfAborted();
      cleared.push({ destination, itemBefore, cleared: false, error: unequipOutcomes.rejected(destination, cause) });
      continue;
    }
    const after = equippedName(bot, destination);
    cleared.push({
      destination,
      itemBefore,
      cleared: after === null,
      ...(after === null ? {} : { error: unequipOutcomes.notCleared(destination, after) }),
    });
  }
  const evidence = { cleared, equipment: equipmentSlots(bot) };
  const failed = cleared.filter((entry) => !entry.cleared).length;
  if (failed === 0) return { status: "succeeded", unequip: evidence };
  return { status: failed === cleared.length ? "failed" : "partial", error: unequipOutcomes.incomplete(failed, cleared.length), unequip: evidence };
}

export function formatUnequipResult(result: UnequipResult): string {
  const lines = result.unequip.cleared.map((entry) =>
    entry.cleared
      ? `- Cleared ${entry.destination}${entry.itemBefore ? ` (${entry.itemBefore})` : ""}.`
      : `- Could not clear ${entry.destination}${entry.itemBefore ? ` (${entry.itemBefore})` : ""}: ${entry.error ?? "unknown"}`,
  );
  const slots = result.unequip.equipment;
  lines.push(
    "",
    `Now holding \`${slots.hand ?? "nothing"}\`; off-hand \`${slots.offHand ?? "nothing"}\`; wearing head \`${slots.head ?? "-"}\`, torso \`${slots.torso ?? "-"}\`, legs \`${slots.legs ?? "-"}\`, feet \`${slots.feet ?? "-"}\`.`,
  );
  if (result.status !== "succeeded") lines.push("", `**Observed stop:** ${result.error}`);
  return lines.join("\n");
}

export function createUnequipAction(bot: Bot) {
  return defineAction({
    name: UNEQUIP,
    description: UNEQUIP_DESCRIPTION,
    inputSchema: unequipInputSchema,
    resultSchema: unequipResultSchema,
    formatResult: formatUnequipResult,
    execution: { kind: "task" },
    annotations: unequipAnnotations,
    parse: parseUnequipRequest,
    execute: (request, context) => unequip(bot, request, context),
  });
}
