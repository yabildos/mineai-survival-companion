# Third-Party Code And Asset Notices

This file records known third-party code and asset sources in this repository. It is a provenance summary, not a substitute for the license files shipped by each upstream project or dependency.

## Engine Source

The code under `ai/engine/` is based on and modifies [Mine AI MCP](https://github.com/aibengineering/mine-ai-mcp) by AI Bengineering.

- Imported upstream commit: `6cdd2bb2728820de5372a77fb649fcb31135b814`
- License: MIT; the upstream license and copyright notice are included in [`ai/engine/LICENSE`](ai/engine/LICENSE).
- Additional restored actions and local changes are summarized in [`ai/engine/UPSTREAM.txt`](ai/engine/UPSTREAM.txt).

## Dependencies

The engine's direct dependencies and pinned Git sources are declared in [`ai/engine/package.json`](ai/engine/package.json) and locked in `ai/engine/bun.lock`. In particular, the current manifest references projects maintained by AI Bengineering, including Mineflayer, Minecraft data, physics, recipes, block highlighting, and Mine Labs. These projects retain their own licenses and notices; consult their upstream repositories and the resolved package metadata before redistributing a bundled copy. Other npm dependencies also retain their respective upstream licenses.

Dependencies are fetched during installation rather than vendored as source in this repository.

## Project-Specific Files And Examples

The playbooks, launcher, tests, documentation, and JSON examples in this repository are project-specific material. No blanket license grant is made for them by this notice. The JSON files in `ai/blueprints/examples/` are example build descriptions maintained in this repository; they are not downloaded schematic files or copied world/build datasets, to the best of the repository's recorded provenance.

## Minecraft Assets

This repository does not intentionally distribute Minecraft game binaries, textures, or other Mojang/Microsoft game assets. The runtime communicates with a Minecraft server through normal gameplay protocols.

## Updating This Notice

When adding third-party source, copied examples, datasets, or assets, record the source URL, revision, license, and any required attribution here, and preserve the upstream license text where required. Verify the licenses of resolved dependencies from their upstream/package metadata; this summary does not establish that every transitive dependency has been individually audited.
