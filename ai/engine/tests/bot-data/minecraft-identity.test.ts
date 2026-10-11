import { describe, expect, test } from "bun:test";
import { deriveMinecraftBotDataIdentity } from "../../src/bot-data/minecraft-identity.js";

function identity(seed: bigint, host = "127.0.0.1", port = 1234) {
  return deriveMinecraftBotDataIdentity({
    host,
    port,
    playerUuid: "AABBCCDD-1234-5678-9ABC-DEF012345678",
    loginPacket: { worldState: { hashedSeed: seed } },
  });
}

describe("Minecraft world memory identity", () => {
  test("is stable for the same server, world and bot", () => {
    expect(identity(42n)).toEqual(identity(42n));
  });

  test("separates different worlds and server endpoints", () => {
    const first = identity(42n);
    expect(identity(43n).worldId).not.toBe(first.worldId);
    expect(identity(42n, "127.0.0.1", 25565).worldId).not.toBe(first.worldId);
    expect(identity(42n, "example.invalid").worldId).not.toBe(first.worldId);
  });

  test("normalizes server host and bot UUID", () => {
    const value = deriveMinecraftBotDataIdentity({
      host: "Example.Invalid",
      port: 25565,
      playerUuid: "AABBCCDD-1234-5678-9ABC-DEF012345678",
      loginPacket: { hashedSeed: [0, 42] },
    });
    expect(value.worldId).toContain("example.invalid");
    expect(value.botId).toBe("aabbccdd-1234-5678-9abc-def012345678");
    expect(value.worldId).toBe(identity(42n, "example.invalid", 25565).worldId);
  });

  test("refuses to guess identity when the server omits required facts", () => {
    expect(() => deriveMinecraftBotDataIdentity({
      host: "localhost", port: 25565, playerUuid: "uuid", loginPacket: {},
    })).toThrow("hashed seed");
    expect(() => deriveMinecraftBotDataIdentity({
      host: "localhost", port: 25565, playerUuid: undefined, loginPacket: { hashedSeed: 1n },
    })).toThrow("player UUID");
  });
});
