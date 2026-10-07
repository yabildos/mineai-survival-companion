import type { Budgets } from "../survival/state/budgets.js";
import { createSetSurvivalPolicyAction } from "./set-survival-policy/index.js";
/**
 * Every model-runnable action this host offers, built once with its dependencies.
 *
 * This is deliberately a list and not a framework. An action owns its own MCP
 * tool schema, argument parsing, dependencies, and execution. Factories close
 * over only what they need so the generic action context stays a cancellation
 * signal rather than becoming a service bag.
 */
import type { Bot } from "mineflayer";
import { snapshotBotStatus, updateBotStatus, type SqlBotData } from "../bot-data/index.js";
import type { NavigationRuntime } from "../navigation/index.js";
import type { SessionFrontier } from "../runtime/frontier.js";
import type { ForegroundCancellation } from "../session/action-runner.js";
import type { CombatController } from "../survival/index.js";
import { createDiscardedItems } from "../world/discarded-items.js";
import type { Action } from "./action.js";
import { createEnchantItemAction, createUseAnvilAction, createTradeVillagerAction, createUpgradeNetheriteAction } from "./advanced-workstations.js";
import { createActivatePortalAction } from "./activate-portal/index.js";
import { createAttackDragonPerchAction } from "./attack-dragon-perch/index.js";
import { createBarterAction } from "./barter/index.js";
import { createBuildStructureAction } from "./build-structure/index.js";
import { createActivateBlockAction } from "./activate-block/index.js";
import { createActivateEntityAction } from "./activate-entity/index.js";
import { createCancelForegroundAction } from "./cancel-foreground-action/index.js";
import { createCheatRadarAction } from "./cheat-radar/index.js";
import { createCloseWindowAction } from "./close-window/index.js";
import { createCollectBlockAction } from "./collect-block/index.js";
import { createCraftItemAction } from "./craft-item/index.js";
import { createDebugExecuteJavaScriptAction } from "./debug-execute-javascript/index.js";
import { createDebugSetPathfinderTelemetryAction } from "./debug-set-pathfinder-telemetry/index.js";
import { createDeliverItemsAction } from "./deliver-items/index.js";
import { createDestroyEndCrystalAction } from "./destroy-end-crystal/index.js";
import { createDropItemAction } from "./drop-item/index.js";
import { createEatFoodAction } from "./eat-food/index.js";
import { createEquipAction } from "./equip/index.js";
import { createExploreFrontierAction } from "./explore-frontier/index.js";
import { createFellTreeAction } from "./fell-tree/index.js";
import { createFollowPlayerAction } from "./follow-player/index.js";
import { createGatherResourceAction } from "./gather-resource/index.js";
import { createGetBlockAction } from "./get-block/index.js";
import { createGetEntitiesAction } from "./get-entities/index.js";
import { createGetInventoryAction } from "./get-inventory/index.js";
import { createGetPathfinderStatusAction } from "./get-pathfinder-status/index.js";
import { createGuardPlayerAction } from "./guard-player/index.js";
import { createCollectMobDropAction } from "./hunt-mob/index.js";
import { createInspectFurnaceAction } from "./inspect-furnace/index.js";
import { createInspectVillagerAction } from "./inspect-villager/index.js";
import { createLocateStrongholdAction, type StrongholdEyeFlights } from "./locate-stronghold/index.js";
import { createLookAtAction } from "./look-at/index.js";
import { createLoadoutManagerAction } from "./loadout-manager/index.js";
import { createMiningAssistantAction } from "./mining-assistant/index.js";
import { createMoveSlotAction } from "./move-slot/index.js";
import { createNavigateAction } from "./navigate/index.js";
import { createNoteReadAction } from "./note-read/index.js";
import { createNoteSaveAction } from "./note-save/index.js";
import { createPlaceBlockAction } from "./place-block/index.js";
import { createPrepareDragonPerchAction } from "./prepare-dragon-perch/index.js";
import { createPickUpItemsAction } from "./pick-up-items/index.js";
import { createEnterEndPortalAction, createEnterNetherPortalAction } from "./portal-entry/index.js";
import { createProspectOreAction } from "./prospect-ore/index.js";
import { createQueryBotDataAction } from "./query-bot-data/index.js";
import { createRawAction } from "./raw-action/index.js";
import { createReadRecentEventsAction } from "./read-recent-events/index.js";
import { createRecoverStateAction } from "./recover-state/index.js";
import { createRespawnAction } from "./respawn/index.js";
import { createScanLoadedBlocksAction } from "./scan-loaded-blocks/index.js";
import { createSceneSnapshotAction } from "./scene-snapshot/index.js";
import { createSendMessageAction } from "./send-message/index.js";
import { createSkillLibraryAction } from "./skill-library/index.js";
import { createSleepAction } from "./sleep/index.js";
import { createShootDragonAction } from "./shoot-dragon/index.js";
import { createSmeltItemAction } from "./smelt-item/index.js";
import { createUseBucketAction } from "./use-bucket/index.js";
import { createUseContainerAction } from "./use-container/index.js";
import { createUseHeldItemAction } from "./use-held-item/index.js";
import { createUnequipAction } from "./unequip/index.js";
import { createUnstuckAction } from "./unstuck/index.js";
import { createTaskJournalAction } from "./task-journal/index.js";
import { createTrailMemoryAction } from "./trail-memory/index.js";
import { createViewBlocksAction } from "./view-blocks/index.js";
import { createViewCraftingRequirementsAction } from "./view-crafting-requirements/index.js";
import { createViewFrontierAction } from "./view-frontier/index.js";
import { createViewStatusAction, type ObserveStatusActivity } from "./view-status/index.js";
import { createWaypointAction } from "./waypoint/index.js";
import { createWaitTicksAction } from "./wait-ticks/index.js";

export interface ActionDependencies {
  readonly budgets: Budgets;
  readonly bot: Bot;
  readonly botData: SqlBotData;
  readonly frontier: SessionFrontier;
  readonly navigation: NavigationRuntime;
  readonly strongholdEyeFlights: StrongholdEyeFlights;
  /** The one combat controller; the hunt fights through it and the hostile reflex reads its state. */
  readonly combat: CombatController;
  readonly cancelForegroundAction: (reason: string) => ForegroundCancellation;
  readonly observeStatusActivity: ObserveStatusActivity;
}

export interface ActionCatalogOptions {
  readonly debugExecuteJavaScript?: boolean;
}

export function createActions(
  {
    bot,
    budgets,
    botData,
    frontier,
    navigation,
    strongholdEyeFlights,
    combat,
    cancelForegroundAction,
    observeStatusActivity,
  }: ActionDependencies,
  options: ActionCatalogOptions = {},
) {
  // One registry, shared: the dropper records what it threw away and the hunt's
  // sweep reads the same set, so a deliberate discard is not picked back up.
  const discarded = createDiscardedItems();
  const actions: Action[] = [
    createEnchantItemAction(bot, navigation),
    createUseAnvilAction(bot, navigation),
    createTradeVillagerAction(bot, navigation),
    createUpgradeNetheriteAction(bot, navigation),
    createSetSurvivalPolicyAction(combat.policy),
    createDestroyEndCrystalAction(bot, combat),
    createAttackDragonPerchAction(bot, combat),
    createShootDragonAction(bot, combat),
    createBuildStructureAction(bot, navigation),
    createActivateBlockAction(bot),
    createActivateEntityAction(bot),
    createCancelForegroundAction(cancelForegroundAction),
    createCheatRadarAction(bot),
    createCloseWindowAction(bot),
    createRecoverStateAction(bot),
    createCollectBlockAction(bot, navigation, discarded),
    createCraftItemAction(bot, navigation),
    createDeliverItemsAction(bot, navigation, botData, discarded),
    createDropItemAction(bot, navigation, discarded),
    createBarterAction(bot, navigation),
    createEatFoodAction(bot),
    createEquipAction(bot),
    createFellTreeAction(bot, navigation, discarded),
    createFollowPlayerAction(bot, navigation, botData),
    createGatherResourceAction(bot, navigation, combat, discarded, budgets),
    createGetBlockAction(bot),
    createGetEntitiesAction(bot),
    createGetInventoryAction(bot),
    createGetPathfinderStatusAction(navigation),
    createGuardPlayerAction(bot, navigation, combat, discarded, budgets),
    createExploreFrontierAction(bot, navigation, frontier, botData),
    createInspectFurnaceAction(bot),
    createInspectVillagerAction(bot),
    createCollectMobDropAction(bot, navigation, combat, discarded, undefined, budgets),
    createActivatePortalAction(bot, navigation),
    createLocateStrongholdAction(bot, navigation, botData, strongholdEyeFlights),
    createLookAtAction(bot),
    createLoadoutManagerAction(bot),
    createMiningAssistantAction(bot, navigation, discarded),
    createMoveSlotAction(bot),
    createWaypointAction(bot, navigation, botData),
    createEnterNetherPortalAction(bot, navigation),
    createEnterEndPortalAction(bot, navigation),
    createNavigateAction(bot, navigation),
    createNoteSaveAction(bot, botData),
    createNoteReadAction(botData, bot.username),
    createPlaceBlockAction(bot, navigation),
    createPrepareDragonPerchAction(bot, combat),
    createPickUpItemsAction(bot, navigation, botData, discarded),
    createProspectOreAction(bot),
    createRawAction(bot),
    createQueryBotDataAction(botData, () => updateBotStatus(botData, snapshotBotStatus(bot))),
    createReadRecentEventsAction(botData, bot.username),
    createRespawnAction(bot),
    createScanLoadedBlocksAction(bot),
    createSceneSnapshotAction(bot),
    createSendMessageAction(bot),
    createSkillLibraryAction(bot, botData),
    createSleepAction(bot, navigation),
    createSmeltItemAction(bot, navigation),
    createUseBucketAction(bot, navigation),
    createUseContainerAction(bot, navigation, botData),
    createUseHeldItemAction(bot),
    createUnequipAction(bot),
    createUnstuckAction(bot),
    createTaskJournalAction(bot, botData),
    createTrailMemoryAction(bot, botData),
    createViewBlocksAction(bot),
    createViewCraftingRequirementsAction(bot),
    createViewFrontierAction(botData, () => snapshotBotStatus(bot)),
    createViewStatusAction(bot, botData, observeStatusActivity),
    createWaitTicksAction(bot),
  ];
  if (options.debugExecuteJavaScript) {
    actions.push(createDebugSetPathfinderTelemetryAction(navigation), createDebugExecuteJavaScriptAction(bot));
  }
  return Object.freeze(actions);
}

export * from "./action.js";
export * from "./activate-block/index.js";
export * from "./activate-entity/index.js";
export * from "./activate-portal/index.js";
export * from "./attack-dragon-perch/index.js";
export * from "./shoot-dragon/index.js";
export * from "./barter/index.js";
export * from "./build-structure/index.js";
export * from "./cancel-foreground-action/index.js";
export * from "./cheat-radar/index.js";
export * from "./close-window/index.js";
export * from "./collect-block/index.js";
export * from "./craft-item/index.js";
export * from "./debug-execute-javascript/index.js";
export * from "./debug-set-pathfinder-telemetry/index.js";
export * from "./deliver-items/index.js";
export * from "./describe.js";
export * from "./destroy-end-crystal/index.js";
export * from "./drop-item/index.js";
export * from "./eat-food/index.js";
export * from "./equip/index.js";
export * from "./explore-frontier/index.js";
export * from "./fell-tree/index.js";
export * from "./follow-player/index.js";
export * from "./gather-resource/index.js";
export * from "./get-block/index.js";
export * from "./get-entities/index.js";
export * from "./get-inventory/index.js";
export * from "./get-pathfinder-status/index.js";
export * from "./guard-player/index.js";
export * from "./inspect-furnace/index.js";
export * from "./inspect-villager/index.js";
export * from "./hunt-mob/index.js";
export * from "./locate-stronghold/index.js";
export * from "./look-at/index.js";
export * from "./loadout-manager/index.js";
export * from "./markdown.js";
export * from "./mining-assistant/index.js";
export * from "./move-slot/index.js";
export * from "./navigate/index.js";
export * from "./note-read/index.js";
export * from "./note-save/index.js";
export * from "./place-block/index.js";
export * from "./prepare-dragon-perch/index.js";
export * from "./pick-up-items/index.js";
export * from "./portal-entry/index.js";
export * from "./prospect-ore/index.js";
export * from "./query-bot-data/index.js";
export * from "./raw-action/index.js";
export * from "./read-recent-events/index.js";
export * from "./recover-state/index.js";
export * from "./respawn/index.js";
export * from "./scan-loaded-blocks/index.js";
export * from "./scene-snapshot/index.js";
export * from "./send-message/index.js";
export * from "./skill-library/index.js";
export * from "./sleep/index.js";
export * from "./smelt-item/index.js";
export * from "./sql-action.js";
export * from "./use-bucket/index.js";
export * from "./use-container/index.js";
export * from "./use-held-item/index.js";
export * from "./unequip/index.js";
export * from "./unstuck/index.js";
export * from "./task-journal/index.js";
export * from "./trail-memory/index.js";
export * from "./view-blocks/index.js";
export * from "./view-crafting-requirements/index.js";
export * from "./view-frontier/index.js";
export * from "./view-status/index.js";
export * from "./waypoint/index.js";
export * from "./wait-ticks/index.js";
