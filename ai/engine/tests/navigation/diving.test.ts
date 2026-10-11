import { describe, expect, test } from "bun:test";
import { breathingReady } from "../../src/navigation/diving.js";

describe("dive breathing verification", () => {
  test("accepts server-confirmed full air", () => {
    expect(breathingReady(300, "water")).toBe(true);
  });

  test("accepts unknown air only when the head is in a breathable air block", () => {
    expect(breathingReady(null, "air")).toBe(true);
    expect(breathingReady(null, "cave_air")).toBe(true);
    expect(breathingReady(null, "water")).toBe(false);
    expect(breathingReady(null, null)).toBe(false);
  });

  test("does not resume with known depleted air", () => {
    expect(breathingReady(299, "air")).toBe(false);
    expect(breathingReady(0, "air")).toBe(false);
  });
});
