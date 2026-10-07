import { describe, expect, test } from "bun:test";
import { parseActivateBlockRequest } from "../../src/actions/activate-block/index.js";
import { parseActivateEntityRequest } from "../../src/actions/activate-entity/index.js";
import { parseCloseWindowRequest } from "../../src/actions/close-window/index.js";
import { parseDeliverItemsRequest } from "../../src/actions/deliver-items/index.js";
import { parseFollowPlayerRequest } from "../../src/actions/follow-player/index.js";
import { parseGatherResourceRequest } from "../../src/actions/gather-resource/index.js";
import { parseGuardPlayerRequest } from "../../src/actions/guard-player/index.js";
import { parseLookAtRequest } from "../../src/actions/look-at/index.js";
import { parseRecoverStateRequest } from "../../src/actions/recover-state/index.js";
import { parseRespawnRequest } from "../../src/actions/respawn/index.js";
import { parseSceneSnapshotRequest } from "../../src/actions/scene-snapshot/index.js";
import { parseUnequipRequest } from "../../src/actions/unequip/index.js";
import { parseUnstuckRequest } from "../../src/actions/unstuck/index.js";
import { parseUseHeldItemRequest } from "../../src/actions/use-held-item/index.js";
import { parseWaypointRequest } from "../../src/actions/waypoint/index.js";

describe("control tool contracts", () => {
  test("parses look_at position and entity targets", () => {
    expect(parseLookAtRequest({ x: 1, y: 2, z: 3 })).toEqual({
      target: { kind: "position", x: 1, y: 2, z: 3 },
      force: true,
    });
    expect(parseLookAtRequest({ entity_id: 7, force: false })).toEqual({
      target: { kind: "entity", entityId: 7 },
      force: false,
    });
    expect(() => parseLookAtRequest({ x: 1, y: 2 })).toThrow();
    expect(() => parseLookAtRequest({ x: 1, y: 2, z: 3, entity_id: 7 })).toThrow();
  });

  test("parses activate_entity", () => {
    expect(parseActivateEntityRequest({ entity_id: 42 })).toEqual({ entityId: 42 });
    expect(() => parseActivateEntityRequest({ entity_id: -1 })).toThrow();
  });

  test("parses activate_block defaults", () => {
    expect(parseActivateBlockRequest({ x: 1, y: 64, z: -2 })).toEqual({ x: 1, y: 64, z: -2, face: "up" });
    expect(parseActivateBlockRequest({ x: 1, y: 64, z: -2, face: "north" })).toEqual({
      x: 1,
      y: 64,
      z: -2,
      face: "north",
    });
  });

  test("parses close_window empty request", () => {
    expect(parseCloseWindowRequest({})).toEqual({});
    expect(parseCloseWindowRequest(undefined)).toEqual({});
    expect(() => parseCloseWindowRequest({ force: true })).toThrow();
  });

  test("parses use_held_item defaults and options", () => {
    expect(parseUseHeldItemRequest({})).toEqual({ operation: "start", hand: "hand", hold_ticks: 0 });
    expect(parseUseHeldItemRequest({ operation: "stop", hand: "off-hand", hold_ticks: 20 })).toEqual({
      operation: "stop",
      hand: "off-hand",
      hold_ticks: 20,
    });
    expect(() => parseUseHeldItemRequest({ hold_ticks: 201 })).toThrow();
  });

  test("parses respawn defaults and bounds", () => {
    expect(parseRespawnRequest({})).toEqual({ wait_ticks: 80 });
    expect(parseRespawnRequest({ wait_ticks: 0 })).toEqual({ wait_ticks: 0 });
    expect(() => parseRespawnRequest({ wait_ticks: 201 })).toThrow();
  });

  test("parses follow_player defaults and safety options", () => {
    expect(parseFollowPlayerRequest({ username: "ExamplePlayer" })).toEqual({
      username: "ExamplePlayer",
      follow_distance: 4,
      duration_ticks: 400,
      repath_ticks: 40,
      dig: false,
      scaffold: true,
    });
    expect(parseFollowPlayerRequest({ follow_distance: 8, duration_ticks: 20 }).username).toBeUndefined();
    expect(() => parseFollowPlayerRequest({ follow_distance: 1 })).toThrow();
  });

  test("parses helper macro tools", () => {
    expect(parseRecoverStateRequest({})).toEqual({ wait_ticks: 40 });
    expect(parseGuardPlayerRequest({ username: "ExamplePlayer" })).toEqual({
      username: "ExamplePlayer",
      duration_ticks: 300,
      follow_distance: 4,
      threat_radius: 24,
    });
    expect(parseDeliverItemsRequest({ to_player: "ExamplePlayer", items: [{ item_name: "oak_log", count: 4 }] })).toEqual({
      to_player: "ExamplePlayer",
      items: [{ item_name: "oak_log", count: 4 }],
    });
    expect(parseGatherResourceRequest({ mode: "block", block_name: "oak_log" })).toEqual({
      mode: "block",
      block_name: "oak_log",
      count: 1,
      allow_without_shield: false,
    });
    expect(parseWaypointRequest({ operation: "save", name: "base" }).operation).toBe("save");
    expect(parseUnstuckRequest({})).toEqual({ attempts: 3 });
    expect(parseSceneSnapshotRequest({})).toEqual({ radius: 8 });
    expect(parseUnequipRequest({ destinations: ["head", "torso", "off-hand", "head"] })).toEqual({
      destinations: ["head", "torso", "off-hand"],
    });
    expect(() => parseUnequipRequest({ destinations: [] })).toThrow();
  });
});
