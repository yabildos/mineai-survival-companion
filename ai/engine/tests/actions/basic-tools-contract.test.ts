import { describe, expect, test } from "bun:test";
import { parseGetBlockRequest } from "../../src/actions/get-block/index.js";
import { parseCheatRadarRequest } from "../../src/actions/cheat-radar/index.js";
import { parseGetPathfinderStatusRequest } from "../../src/actions/get-pathfinder-status/index.js";
import { parseInspectFurnaceRequest } from "../../src/actions/inspect-furnace/index.js";
import { parseInspectVillagerRequest } from "../../src/actions/inspect-villager/index.js";
import { parseLoadoutManagerRequest } from "../../src/actions/loadout-manager/index.js";
import {
  formatGetEntitiesResult,
  parseGetEntitiesRequest,
  type GetEntitiesResult,
} from "../../src/actions/get-entities/index.js";
import { parseWaitTicksRequest } from "../../src/actions/wait-ticks/index.js";
import { parseProspectOreRequest } from "../../src/actions/prospect-ore/index.js";
import { parseScanLoadedBlocksRequest } from "../../src/actions/scan-loaded-blocks/index.js";
import { parseMiningAssistantRequest } from "../../src/actions/mining-assistant/index.js";
import { parseMoveSlotRequest } from "../../src/actions/move-slot/index.js";
import { parseSkillLibraryRequest } from "../../src/actions/skill-library/index.js";
import { parseTaskJournalRequest } from "../../src/actions/task-journal/index.js";
import { parseTrailMemoryRequest } from "../../src/actions/trail-memory/index.js";

describe("basic inspection/control tools", () => {
  test("parses get_block coordinates", () => {
    expect(parseGetBlockRequest({ x: 1, y: 64, z: -2 })).toEqual({ x: 1, y: 64, z: -2 });
    expect(() => parseGetBlockRequest({ x: 1, y: 64 })).toThrow();
  });

  test("parses get_entities defaults and filters", () => {
    expect(parseGetEntitiesRequest({})).toEqual({ limit: 32, include_self: false });
    expect(parseGetEntitiesRequest({ names: ["piglin"], max_distance: 16, limit: 4 })).toEqual({
      names: ["piglin"],
      max_distance: 16,
      limit: 4,
      include_self: false,
    });
  });

  test("formats get_entities output", () => {
    const result: GetEntitiesResult = {
      status: "succeeded",
      entities: {
        dimension: "the_nether",
        origin: { x: 0, y: 64, z: 0 },
        totalLoaded: 2,
        matched: 1,
        listed: [
          {
            entityId: 42,
            name: "piglin",
            displayName: "Piglin",
            kind: "hostile",
            distance: 3.5,
            position: { x: 1, y: 64, z: 3 },
            age: "adult",
            health: 16,
            username: null,
            heldItem: "gold_ingot",
            droppedItem: null,
          },
        ],
      },
    };
    expect(formatGetEntitiesResult(result)).toContain("#42 piglin");
    expect(formatGetEntitiesResult(result)).toContain("holding gold_ingot");
  });

  test("parses wait_ticks defaults and bounds", () => {
    expect(parseWaitTicksRequest({})).toEqual({ ticks: 20 });
    expect(parseWaitTicksRequest({ ticks: 40 })).toEqual({ ticks: 40 });
    expect(() => parseWaitTicksRequest({ ticks: 0 })).toThrow();
    expect(() => parseWaitTicksRequest({ ticks: 1201 })).toThrow();
  });

  test("parses loaded scan and ore prospect requests", () => {
    expect(parseCheatRadarRequest({})).toEqual({
      modes: ["all"],
      radius: 96,
      limit: 16,
      center: null,
      minY: null,
      maxY: null,
    });
    expect(parseCheatRadarRequest({ modes: ["chests", "danger"], radius: 32, limit: 4 })).toEqual({
      modes: ["chests", "danger"],
      radius: 32,
      limit: 4,
      center: null,
      minY: null,
      maxY: null,
    });
    expect(parseCheatRadarRequest({ modes: ["portals"], center_x: 222, center_y: 78, center_z: 40 })).toEqual({
      modes: ["portals"],
      radius: 96,
      limit: 16,
      center: { x: 222, y: 78, z: 40 },
      minY: null,
      maxY: null,
    });
    expect(() => parseCheatRadarRequest({ center_x: 222 })).toThrow("center_x, center_y, and center_z must be supplied together.");
    expect(parseScanLoadedBlocksRequest({ block_names: ["diamond_ore", "logs"], min_y: -64, max_y: 16 })).toEqual({
      blockNames: ["diamond_ore", "logs"],
      limit: 16,
      radius: null,
      minY: -64,
      maxY: 16,
      center: null,
    });
    expect(parseProspectOreRequest({ targets: ["diamond", "ancient_debris"], radius: 96 })).toEqual({
      targets: ["diamond", "ancient_debris"],
      limitPerTarget: 8,
      radius: 96,
      minY: null,
      maxY: null,
    });
    expect(parseGetPathfinderStatusRequest({})).toEqual({});
    expect(parseInspectFurnaceRequest({ x: 1, y: 64, z: -2 })).toEqual({ x: 1, y: 64, z: -2 });
    expect(parseInspectVillagerRequest({ entity_id: 42 })).toEqual({ entity_id: 42 });
    expect(parseLoadoutManagerRequest({ profile: "mining" })).toEqual({ profile: "mining", strict: false });
    expect(parseMoveSlotRequest({ from_slot: 9, to_slot: 10 })).toEqual({ from_slot: 9, to_slot: 10, allow_window: false });
    expect(parseMiningAssistantRequest({ operation: "safe_mine_batch", block_name: "diamond_ore", count: 8 })).toEqual({
      operation: "safe_mine_batch",
      blockName: "diamond_ore",
      count: 8,
      minPickaxeDurabilityReserve: 32,
      requireFood: true,
      requireBlocks: true,
    });
    expect(parseMiningAssistantRequest({ operation: "return_to_surface" }).operation).toBe("return_to_surface");
    expect(parseTaskJournalRequest({
      operation: "create_plan",
      title: "Mine diamonds",
      goal: "Get diamonds safely",
      steps: [{ description: "Inspect loadout", tool_hint: "mining_assistant" }],
    }).operation).toBe("create_plan");
    expect(parseSkillLibraryRequest({
      operation: "save",
      name: "safe diamond batch",
      description: "Inspect, prospect, mine a small batch.",
      tool_sequence: [{ tool: "mining_assistant", args: { operation: "inspect_loadout" } }],
      tags: ["mining"],
    }).operation).toBe("save");
    expect(parseTrailMemoryRequest({ operation: "mark", kind: "exit", label: "stair", note: "safe way up" }).operation).toBe("mark");
    expect(() => parseScanLoadedBlocksRequest({ block_names: ["diamond_ore"], min_y: 16, max_y: -64 })).toThrow();
    expect(() => parseProspectOreRequest({ targets: ["wood"] })).toThrow();
    expect(() => parseCheatRadarRequest({ modes: ["all"], radius: 7 })).toThrow();
    expect(() => parseMiningAssistantRequest({ operation: "safe_mine_batch" })).toThrow();
    expect(() => parseMoveSlotRequest({ from_slot: 9, to_slot: 9 })).toThrow();
    expect(() => parseTaskJournalRequest({ operation: "create_plan", title: "x" })).toThrow();
    expect(() => parseSkillLibraryRequest({ operation: "find" })).toThrow();
    expect(() => parseTrailMemoryRequest({ operation: "mark", kind: "exit" })).toThrow();
  });
});
