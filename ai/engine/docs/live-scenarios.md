# Live scenario checklist

Run these in a real LAN world after restarting MineAI. Record failures with
`task_journal operation=record_failure`; save successful reusable sequences with
`skill_library operation=save` and source `executor_verified`.

1. Follow and reacquire the player after they leave loaded range.
2. Inspect a mining loadout, prospect ore, mine 8 ore, mark the trail, and return.
3. Fell a normal tree and a huge mushroom tree completely.
4. Deposit inventory into a chest, move one exact slot, unequip armor, and verify.
5. Inspect a furnace, smelt a small batch, inspect again, and recover output.
6. Inspect a villager's offers without trading, then perform one chosen trade.
7. Use `cheat_radar` near a cave and verify at least one reported danger or chest.
8. Trigger a stuck/no-path situation and confirm `get_pathfinder_status`,
   `unstuck`, and `task_journal` produce a useful recovery record.
