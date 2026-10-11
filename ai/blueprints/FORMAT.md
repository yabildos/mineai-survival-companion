# MineAI Blueprint Format

Blueprint coordinates are relative to an origin block chosen at build time.
Positive `x` is right, positive `z` is forward, positive `y` is up.

```json
{
  "schema": "mineai.blueprint.v1",
  "name": "starter-sugar-cane-farm",
  "category": "farm",
  "minecraft_version": "1.21.x",
  "size": { "x": 5, "y": 3, "z": 4 },
  "survival": {
    "safe_for_bot": true,
    "requires_entities": [],
    "requires_water": true,
    "notes": ["Place sugar cane by hand after the structure is built."]
  },
  "materials": { "dirt": 5, "water_bucket": 1 },
  "phases": [
    {
      "name": "foundation",
      "blocks": [{ "x": 0, "y": 0, "z": 0, "block_name": "dirt" }]
    }
  ]
}
```

`blocks` are relative cells. Add the chosen origin coordinates to each cell to
produce the absolute coordinates expected by `build_structure`.

Keep names as Minecraft registry names without the `minecraft:` prefix.

The executor accepts block names, not block-state properties. For directional
blocks and mechanisms, verify orientation and function in the live world; do
not assume the example alone is a tested design.
