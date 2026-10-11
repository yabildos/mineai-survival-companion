import { describe, expect, it } from "bun:test";
import { blockMatchesSelector } from "../../src/actions/collect-block/collection-facts.js";

describe("block selectors", () => {
  it("keeps mushroom trunks out of ordinary logs and wood", () => {
    expect(blockMatchesSelector("mushroom_stem", "logs")).toBe(false);
    expect(blockMatchesSelector("mushroom_stem", "wood")).toBe(false);
    expect(blockMatchesSelector("mushroom_stem", "mushroom_tree")).toBe(true);
    expect(blockMatchesSelector("big_dripleaf_stem", "logs")).toBe(false);
    expect(blockMatchesSelector("big_dripleaf_stem", "wood")).toBe(false);
  });

  it("includes Nether stems with normal wood selectors", () => {
    expect(blockMatchesSelector("crimson_stem", "logs")).toBe(true);
    expect(blockMatchesSelector("warped_stem", "wood")).toBe(true);
  });
});
