import { describe, expect, test } from "bun:test";
import { cropIsMature, parseFarmAssistantRequest } from "../../src/actions/farm-assistant/contract.js";

describe("farm assistant", () => {
  test("uses vanilla maturity ages for supported crops", () => {
    expect(cropIsMature("wheat", 6)).toBe(false);
    expect(cropIsMature("wheat", 7)).toBe(true);
    expect(cropIsMature("beetroots", 2)).toBe(false);
    expect(cropIsMature("beetroots", 3)).toBe(true);
  });

  test("bounds local farming and defaults to inspection", () => {
    expect(parseFarmAssistantRequest({})).toEqual({ operation: "inspect", radius: 8, max_crops: 4 });
    expect(() => parseFarmAssistantRequest({ operation: "harvest_replant", radius: 25 })).toThrow();
    expect(() => parseFarmAssistantRequest({ operation: "harvest_replant", max_crops: 9 })).toThrow();
  });
});
