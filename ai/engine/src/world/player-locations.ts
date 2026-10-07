import type { Position3 } from "../utils/index.js";
import type { SqlBotData } from "../bot-data/sql-bot-data.js";

export interface KnownPlayerLocation {
  readonly position: Position3;
  readonly dimension: string;
  readonly seenAt: number;
}

const locations = new Map<string, KnownPlayerLocation>();
const MAX_AGE_MS = 30 * 60_000;

export function rememberPlayerLocation(username: string, position: Position3, dimension: string): void {
  locations.set(username.toLowerCase(), { position: { ...position }, dimension, seenAt: Date.now() });
}

export function rememberPlayerLocationInData(
  data: SqlBotData,
  username: string,
  position: Position3,
  dimension: string,
): void {
  rememberPlayerLocation(username, position, dimension);
  data.transaction((database) => {
    database.prepare(`
      INSERT INTO player_locations (username, dimension, x, y, z, seen_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        dimension = excluded.dimension,
        x = excluded.x,
        y = excluded.y,
        z = excluded.z,
        seen_at = excluded.seen_at
    `).run(username, dimension, position.x, position.y, position.z, new Date().toISOString());
  }, { name: "remember-player-location" });
}

export function knownPlayerLocation(username: string, dimension: string): KnownPlayerLocation | null {
  const value = locations.get(username.toLowerCase());
  if (!value || value.dimension !== dimension || Date.now() - value.seenAt >= MAX_AGE_MS) return null;
  return value;
}

export function knownPlayerLocationFromData(
  data: SqlBotData,
  username: string,
  dimension: string,
): KnownPlayerLocation | null {
  const remembered = knownPlayerLocation(username, dimension);
  if (remembered) return remembered;
  const row = data.read(
    "SELECT dimension, x, y, z, seen_at FROM player_locations WHERE username = ? COLLATE NOCASE",
    username,
  )[0];
  if (!row || row.dimension !== dimension || typeof row.seen_at !== "string") return null;
  const seenAt = Date.parse(row.seen_at);
  if (!Number.isFinite(seenAt) || Date.now() - seenAt >= MAX_AGE_MS) return null;
  const value: KnownPlayerLocation = {
    position: { x: Number(row.x), y: Number(row.y), z: Number(row.z) },
    dimension,
    seenAt,
  };
  locations.set(username.toLowerCase(), value);
  return value;
}
