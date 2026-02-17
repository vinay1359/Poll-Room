import { getRedisClient } from "@/lib/redisClient";

interface RateLimitInput {
  ipHash: string;
  pollId: string;
}

interface RateLimitResult {
  trustDelta: number;
  cooldownMs: number;
}

const memoryWindow = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 10 * 60 * 1000;
const WHITELIST_MS = 24 * 60 * 60 * 1000;
const PENALTY_MS = 6 * 60 * 60 * 1000;

export async function rateLimitCheck(
  input: RateLimitInput
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  if (redis) {
    return redisRateLimit(redis, input.ipHash);
  }

  return memoryRateLimit(input);
}

async function redisRateLimit(
  redis: NonNullable<ReturnType<typeof getRedisClient>>,
  ipHash: string
): Promise<RateLimitResult> {
  const now = Date.now();
  const rateKey = `rate:${ipHash}`;
  const cooldownKey = `cooldown:${ipHash}`;
  const whitelistKey = `whitelist:${ipHash}`;
  const penaltyKey = `penalty:${ipHash}`;

  const cooldownTtl = await redis.pttl(cooldownKey);
  if (cooldownTtl > 0) {
    return { trustDelta: -30, cooldownMs: cooldownTtl };
  }

  await redis
    .multi()
    .zadd(rateKey, now.toString(), now.toString())
    .zremrangebyscore(rateKey, 0, now - WINDOW_MS)
    .pexpire(rateKey, PENALTY_MS)
    .exec();

  const count = await redis.zcard(rateKey);

  if (count <= 2) {
    await redis.set(whitelistKey, "1", "PX", WHITELIST_MS);
    return { trustDelta: 15, cooldownMs: 0 };
  }

  if (count <= 5) {
    return { trustDelta: 5, cooldownMs: 0 };
  }

  await redis.set(cooldownKey, "1", "PX", COOLDOWN_MS);
  await redis.set(penaltyKey, "1", "PX", PENALTY_MS);
  return { trustDelta: -30, cooldownMs: COOLDOWN_MS };
}

function memoryRateLimit(input: RateLimitInput): RateLimitResult {
  // Track globally per IP, not per poll - prevents voting spam across multiple polls
  const key = `${input.ipHash}`;
  const now = Date.now();

  const existing = memoryWindow.get(key);
  if (!existing || existing.resetAt < now) {
    memoryWindow.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { trustDelta: 15, cooldownMs: 0 };
  }

  existing.count += 1;
  if (existing.count <= 2) {
    return { trustDelta: 15, cooldownMs: 0 };
  }

  if (existing.count <= 5) {
    return { trustDelta: 5, cooldownMs: 0 };
  }

  return { trustDelta: -30, cooldownMs: COOLDOWN_MS };
}
