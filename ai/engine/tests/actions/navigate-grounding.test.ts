import { describe, expect, test } from "bun:test";
import { requiresGroundedArrival } from "../../src/actions/navigate/contract.js";

describe("navigate grounding postcondition", () => {
  test("requires stable footing for dry land targets", () => {
    expect(requiresGroundedArrival(false, true, false)).toBe(true);
    expect(requiresGroundedArrival(false, true, true)).toBe(false);
  });

  test("allows swimming targets and intentional scaffold builds", () => {
    expect(requiresGroundedArrival(false, false, false)).toBe(false);
    expect(requiresGroundedArrival(true, true, false)).toBe(false);
  });
});
