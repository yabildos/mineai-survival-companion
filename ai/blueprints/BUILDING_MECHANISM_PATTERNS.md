# Building Mechanism Patterns

Distilled from the local Kaggle Minecraft builds metadata. The raw dataset is not needed at runtime.

## Useful Categories

- redstone: 98 candidate builds
- farm: 34 candidate builds
- villagers: 30 candidate builds
- utility: 28 candidate builds
- mob-farm: 26 candidate builds
- travel: 18 candidate builds
- storage: 16 candidate builds

## What MineAI Should Learn

- Prefer utility builds over decorative buildings: farms, storage, villagers, redstone, portals and mob systems.
- Convert selected builds into small blueprints only after checking material cost, footprint and survival safety.
- Reject oversized, decorative, creative-only and house/castle/statue builds unless the user explicitly asks.
- For farms and mechanisms, extract the functional pattern: inputs, outputs, required mobs/villagers, redstone parts, footprint and maintenance access.
- Build in phases: foundation, functional blocks, containers, redstone, safety shell, test access.

## Candidate Selection Rules

- Keep small or medium builds first.
- Prefer schematics with clear tags such as farm, villager, redstone, storage, sorter, spawner, auto or hopper.
- Before building in survival, run material estimation and choose a smaller variant if resources are missing.
- Treat every imported build as untrusted until converted into MineAI's own blueprint format.

## Next Implementation Step

Create a tiny curated set from `mechanism-candidates.json`, then implement `estimate_blueprint_materials` and `build_blueprint`.

