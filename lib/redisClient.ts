import Redis from "ioredis";

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (client) return client;
  client = new Redis(url);
  return client;
}
