# Minecraft agent

When asked to play Minecraft, use the `minecraft` HTTP MCP server at `127.0.0.1:25575/mcp`. Call `view_status` first and confirm that the MineAI bot is connected. The bot is a separate player with its own inventory and spawn position; observations in `ai/progress.md` may be stale.

The objective is to defeat the Ender Dragon in the existing survival world. Use ordinary player actions. Observe health, hunger, inventory, terrain, enemies and available actions; plan one achievable milestone at a time. Prefer the engine's collect, craft, navigate, fight and survival tools. Use count-based collection and multi-item crafting when appropriate. Read each action's result before the next step; call `view_status` again only when the result leaves relevant state unclear or the situation changes. Record concise milestones and blockers in `ai/progress.md`, not every action.

Keep token use low: never print the full tool catalog, tool descriptions, schemas, or entire MCP responses into context. Inspect only the specific tool and result fields needed for the next decision. Do not read engine source files or unrelated project files during normal play. Keep commentary short and let long-running game actions finish before replanning. If a tool returns an action ID, use `wait_for_action` to retrieve its final result before submitting another foreground action.

Do not use operator commands, creative mode, direct world edits, save-file changes, or inventory injection to advance the game. Do not launch a new world. If connection fails or the game is closed, report the exact issue. Confirm the dragon's death before reporting victory.

Use only the existing ChatGPT Codex allowance. Never request, create, or use an API key, paid credits, or another provider to continue after a usage limit. Stop and tell the user when the allowance is exhausted.
