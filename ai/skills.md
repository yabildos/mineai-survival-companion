# MineAI skill recipes

Use these recipes before inventing a custom plan. They are short on purpose:
pick one, run the next action, observe the result, continue.

## Planning And Learning

Use for any multi-step request, repeated job, or task that already failed once.

1. Search `skill_library` for a matching previous skill.
2. If no skill fits, create a `task_journal` plan with short concrete steps.
3. Mark steps completed only after executor/tool evidence confirms them.
4. Record failures with `task_journal operation=record_failure` using a typed
   reason such as `no_path`, `no_tool`, `tool_broke`, `inventory_full`,
   `player_unloaded`, `unsafe_lava`, `window_failed`, or `stuck_loop`.
5. Save successful reusable sequences with `skill_library operation=save` and
   source `executor_verified`.
6. Prefer executor-verified and observed memory over planner or user claims when
   deciding where to go or what has already been done.

## Follow Or Come

Use when the user says "follow", "come", "stay near", "help me", or gives no
specific task.

1. `view_status`
2. If a player is loaded, call `follow_player`.
3. If the named player is unloaded, `follow_player` and `deliver_items` use the
   last position observed in the current runtime for up to 30 minutes and route
   there to reacquire them. If MineAI has never observed that player and has no
   coordinate, ask the user for a direction or coordinate.

## Gather A Resource

Use when the user asks for wood, stone, food, ore, blocks, or mob drops.

1. `get_inventory`
2. If already carrying enough, go to the player or known delivery chest.
3. Use `fell_tree` for "tree", "wood tree", "logs", Nether stems, or huge
   mushroom trees. Do not collect only the bottom two logs.
4. Before any tree or log harvest, equip an iron axe or better and keep a spare
   iron axe in inventory. If either is missing, prepare the required tools:
   craft a wooden pickaxe from carried wood, mine cobblestone for a stone
   pickaxe and furnace, mine iron ore and coal, smelt iron, then craft the axe
   pair. If an axe breaks, make or use a replacement before resuming the same
   request; never continue with a wooden, stone, or no axe.
5. Use `gather_resource` first for simple block, mob drop, or craft requests.
   Fall back to `collect_block`, `hunt_mob`, `craft_item`, `smelt_item`, or
   `pick_up_items` only when the macro does not fit.
6. Stop when the count is met; do not over-farm.
7. For diamond/deep ore requests, call `prospect_ore` first when underground
   or in a loaded mining area. Use `scan_loaded_blocks` for exact block queries
   such as ancient debris, chests, spawners, mushroom blocks, logs, lava, or
   mixed targets. These are read-only loaded-chunk scans; they are not seed-wide
   Chunkbase data.
8. Mine diamonds, ancient debris, or other deep ores in batches of 32 or fewer
   and reassess pickaxe durability before continuing. Prefer
   `mining_assistant operation=safe_mine_batch` for these batches.
9. Deliver with `deliver_items`, by depositing in the named chest, or by
   dropping items only when the user asked for a handoff.

## Mining Safety

Use before mining trips, when underground, or when the user asks for diamonds,
ancient debris, many ores, or "stacks" of underground resources.

1. Start with `mining_assistant operation=inspect_loadout`.
2. If blockers mention pickaxe durability, food, blocks, or free slots, fix
   those before mining.
3. Use `loadout_manager profile=mining` to get a concise preparation checklist.
4. Use `prospect_ore` or `cheat_radar` to choose loaded targets.
5. Use `mining_assistant operation=safe_mine_batch` for at most 32 blocks.
6. Use `mining_assistant operation=return_to_surface` before the pickaxe is
   near its reserve, before inventory fills, or when the route becomes unclear.
7. Use `get_pathfinder_status` if the bot appears stuck, slow, or navigation is
   busy.
8. Use `trail_memory operation=mark` for underground exits, hazards, stuck
   points and resource clusters.

## Base Helper

Use near the player's base.

1. Save important places with `waypoint`: base, storage, mine, farm, portal.
2. Keep `dig: false` unless the user asked to remodel.
3. Prefer `use_container inspect` before withdrawals.
4. For storage work, use `use_container deposit/withdraw/organize`.
5. For building, use `build_structure` or `place_block`; avoid random block
   placement.
6. If a container fails twice, close the window and switch tasks.

## Gear Changes

Use when the user asks to remove armor, clear the hand/off-hand, swap armor, or
drop an item that is currently worn.

1. Use `get_inventory` to confirm current equipment.
2. Use `unequip` for `hand`, `off-hand`, `head`, `torso`, `legs`, or `feet`.
3. Use `equip` only after the target slot is clear or when directly replacing
   with a carried item is intended.
4. Never use `drop_item` on worn armor or off-hand items until `unequip`
   confirms the slot is clear.

## Inventory And Windows

Use when slots are messy, a recipe/window needs exact placement, or a furnace
looks stuck.

1. Use `get_inventory` or `view_status` before exact slot work.
2. Use `loadout_manager` for profile readiness instead of guessing from raw
   inventory.
3. Use `move_slot` only when exact `from_slot` and `to_slot` are known.
4. Use `inspect_furnace` before mutating a furnace whose contents are unknown.
5. Use `inspect_villager` before spending emeralds with `trade_villager`.
6. Prefer `use_container inspect` before container deposit/withdraw/organize.

## Cheat-Like Read-Only Radar

Use when the user asks for x-ray-like help, nearby hidden resources, loaded
structures, chests, spawners, portals, caves, hostiles behind walls or danger
checks.

1. Use `cheat_radar` with `modes=["all"]` for a broad loaded-data sweep.
2. Use focused modes when the request is specific: `chests`, `spawners`,
   `portals`, `caves`, `entities`, `danger`, `structures`, or `hints`.
3. Use `prospect_ore` for ore-only decisions.
4. Use `scan_loaded_blocks` for exact block names or mixed custom targets.
5. Treat all radar results as loaded-client-data only; never claim it checked
   the whole seed or unloaded chunks.

## Guard Player

Use when hostiles are nearby or the user asks for protection.

1. `view_status`
2. Use `guard_player`.
3. Use `hunt_mob` only for immediate threats or requested targets that
   `guard_player` could not handle.
4. Eat/equip first if health, hunger, weapon or shield state is poor.

## Recovery

Use after death, disconnect, stuck navigation or confusing state.

1. `recover_state`
2. Use `unstuck` if the bot did not move or navigation stopped in place.
3. Use `scene_snapshot` when spatial state is confusing.
4. `get_inventory`
5. Choose either retrieve dropped items, return to player/base, or report the
   blocker.

## Waypoints

Use when the user says "remember this", "this is base", "go home", "go to mine",
or names a recurring place.

1. Save current place: `waypoint operation=save`.
2. List known places: `waypoint operation=list`.
3. Go to a place: `waypoint operation=go`.
4. Delete stale places: `waypoint operation=delete`.

## Anti-Patterns

- Do not manually navigate to a moving player when `follow_player` fits.
- Do not manually combine follow/drop for handoff when `deliver_items` fits.
- Do not manually combine follow/hunt for protection when `guard_player` fits.
- Do not manually combine respawn/close/wait/status when `recover_state` fits.
- Do not rediscover base/farm/mine/portal when `waypoint` can remember it.
- Do not keep retrying navigation from the same stuck cell; use `unstuck` or
  `scene_snapshot`.
- Do not run broad exploration for a simple local request.
- Do not strip mine blindly when a loaded-chunk scan or ore prospect can answer
  whether the target is already visible to the bot.
- Do not start deep mining without a pickaxe reserve, food, escape blocks and
  free inventory slots.
- Do not repeat a failed coordinate route without inspecting why it failed.
- Do not keep pursuing old scenario notes after a new user goal.
