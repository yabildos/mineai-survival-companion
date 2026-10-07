# Tool roadmap

## Immediate reliability

- Fix `packet_window_items`/slot parsing disconnects before expanding GUI-heavy tools.
- Add a regression fixture for the packet/window shape that currently disconnects the bot.
- Make runtime disconnects return clear MCP status and incident references.
- Split advanced workstation actions into separate modules with stronger window cleanup.

## Core read-only tools

- `get_inventory` - added.
- Equipment, players, dimension, time and weather are already included in `view_status`; `get_entities` can also filter players.
- `get_entities` - added.
- `get_block` - added.
- `get_pathfinder_status` - added.
- `view_blocks` already supports nearest matching blocks in loaded chunks.
- `scan_loaded_blocks` - added for read-only loaded-chunk block queries.
- `prospect_ore` - added for read-only loaded-chunk ore prospecting.
- `cheat_radar` - added for structures, caves, entities, chests, spawners, portals, danger and loaded-data hints.
- `scene_snapshot` - added.
- `get_biome`
- `get_light`
- `get_pathfinder_status`

## Core control tools

- `wait_ticks` - added.
- `look_at` - added.
- `activate_block` - added.
- `activate_entity` - added.
- `use_held_item` - added.
- `unequip` - added for clearing hand, off-hand and armor slots.
- `close_window` - added.
- `respawn` - added.
- `recover_state` - added.
- `unstuck` - added.
- `raw_action` already exposes one short control state at a time, including `jump`, `sneak`, `sprint`, and directional movement (up to 40 ticks). There is no dedicated jump action or combined control request. `navigate` requires a supported route and cannot be used as a deliberate jump into open air.

## Inventory/window tools

- Container inspection and transfers are already available through `use_container`.
- `inspect_furnace` - added.
- `inspect_villager` - added.
- `move_slot` - added.
- `loadout_manager` - added for profile readiness checks.

## Companion tools

- `task_journal` - added for structured plans, step status and failure classification.
- `skill_library` - added for reusable tool sequences.
- `trail_memory` - added for route breadcrumbs, exits, hazards and stuck points.
- `follow_player` - added.
- `guard_player` - added.
- `deliver_items` - added.
- `gather_resource` - added.
- `mining_assistant` - added for loadout checks, safe mining batches and loaded upper-exit return.
- `fell_tree` - added, including mushroom-tree support.
- `waypoint` - added, with save/list/go/delete operations.
- `carry_loadout`

## Farming and utility

- `till_soil`
- `plant_seed`
- `harvest_crop`
- `shear_entity`
- `milk_cow`
- `fish`
