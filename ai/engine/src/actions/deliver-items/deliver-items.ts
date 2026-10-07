import type { Bot } from "mineflayer";
import type { SqlBotData } from "../../bot-data/sql-bot-data.js";
import { createMovements, type NavigationRuntime } from "../../navigation/index.js";
import { prepareBotForMovement } from "../../session/prepare-body.js";
import { createDiscardedItems, type DiscardedItems } from "../../world/discarded-items.js";
import { placeSolidBlockInto } from "../../world/placement.js";
import { knownPlayerLocationFromData, rememberPlayerLocationInData } from "../../world/player-locations.js";
import { defineAction, type ActionContext } from "../action.js";
import { dropItem } from "../drop-item/drop-item.js";
import { navigate } from "../navigate/navigate.js";
import {
  DELIVER_ITEMS,
  DELIVER_ITEMS_DESCRIPTION,
  deliverItemsAnnotations,
  deliverItemsInputSchema,
  deliverItemsResultSchema,
  parseDeliverItemsRequest,
  type DeliverItemsRequest,
  type DeliverItemsResult,
} from "./contract.js";

async function run(
  bot: Bot,
  navigation: NavigationRuntime,
  data: SqlBotData,
  discarded: DiscardedItems,
  request: DeliverItemsRequest,
  context: ActionContext,
): Promise<DeliverItemsResult> {
  const loaded = bot.players[request.to_player]?.entity;
  if (loaded?.position) rememberPlayerLocationInData(data, request.to_player, loaded.position, bot.game.dimension);
  if (!loaded) {
    const known = knownPlayerLocationFromData(data, request.to_player, bot.game.dimension);
    if (known) {
      const route = await navigate(
        bot,
        { x: Math.floor(known.position.x), y: Math.floor(known.position.y), z: Math.floor(known.position.z), range: 3, dig: false, scaffold: false, build: false },
        context,
        { createMovements, navigate: navigation.navigate },
      );
      if (route.status === "failed" || route.status === "cancelled") {
        return {
          status: route.status === "cancelled" ? "cancelled" : "partial",
          error: `[DELIVERY_PLAYER_ROUTE_FAILED] Could not reach ${request.to_player}'s last observed location (${known.position.x.toFixed(1)}, ${known.position.y.toFixed(1)}, ${known.position.z.toFixed(1)}): ${route.error}`,
          delivery: { toPlayer: request.to_player, requestedItems: request.items.map((item) => ({ item: item.item_name, count: item.count ?? null })), deliveredKinds: 0, failedKinds: request.items.length },
        };
      }
    }
  }
  const drop = await dropItem(
    bot,
    {
      items: request.items.map((item) => ({ itemName: item.item_name, count: item.count ?? null })),
      destination: { kind: "player", name: request.to_player },
      allowEquipped: false,
    },
    context,
    {
      navigate: navigation.navigate,
      breakInPlace: navigation.breakBlockInPlace,
      placeInto: placeSolidBlockInto,
      createMovements,
    },
    discarded,
  );
  const failedKinds = drop.drop.dropped.filter((item) => item.error).length;
  const evidence = {
    toPlayer: request.to_player,
    requestedItems: request.items.map((item) => ({ item: item.item_name, count: item.count ?? null })),
    deliveredKinds: drop.drop.dropped.length - failedKinds,
    failedKinds,
  };
  if (drop.status === "succeeded") return { status: "succeeded", delivery: evidence };
  return { status: drop.status === "cancelled" ? "cancelled" : "partial", error: drop.error, delivery: evidence };
}

export function formatDeliverItemsResult(result: DeliverItemsResult): string {
  const d = result.delivery;
  return [
    `Delivery to ${d.toPlayer}: ${d.deliveredKinds}/${d.requestedItems.length} item kinds delivered.`,
    ...(result.status === "succeeded" ? [] : [`Observed stop: ${result.error}`]),
  ].join("\n");
}

export function createDeliverItemsAction(
  bot: Bot,
  navigation: NavigationRuntime,
  data: SqlBotData,
  discarded: DiscardedItems = createDiscardedItems(),
) {
  return defineAction({
    name: DELIVER_ITEMS,
    description: DELIVER_ITEMS_DESCRIPTION,
    inputSchema: deliverItemsInputSchema,
    resultSchema: deliverItemsResultSchema,
    formatResult: formatDeliverItemsResult,
    execution: { kind: "task", prepare: () => prepareBotForMovement(bot, navigation) },
    annotations: deliverItemsAnnotations,
    parse: parseDeliverItemsRequest,
    execute: (request, context) => run(bot, navigation, data, discarded, request, context),
  });
}
