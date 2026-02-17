import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { hashValue } from "@/lib/hash";
import { checkVoteTrust } from "@/lib/trustScore";
import { rateLimitCheck } from "@/lib/rateLimit";
import { publishPollUpdate } from "@/lib/realtimePublisher";
import { validateNonce } from "@/lib/nonceTracker";

const voteSchema = z.object({
  pollId: z.string().uuid(),
  optionId: z.string().uuid(),
  fingerprint: z.string().min(10),
  behaviorScore: z.number().min(0).max(10).optional(),
  verified: z.boolean().optional(),
  timestamp: z.number().optional(),
  nonce: z.string().length(64).optional() // Unique token for replay protection
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = voteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Nonce validation - prevents replay attacks (each nonce can only be used once)
  if (parsed.data.nonce) {
    const nonceCheck = validateNonce(parsed.data.nonce);
    if (!nonceCheck.valid) {
      return NextResponse.json(
        { error: "Invalid or reused request token", reason: nonceCheck.reason },
        { status: 400 }
      );
    }
  }

  // Timestamp validation - reject old requests  
  if (parsed.data.timestamp) {
    const age = Date.now() - parsed.data.timestamp;
    if (age > 5 * 60 * 1000 || age < 0) {
      return NextResponse.json(
        { error: "Request expired or invalid timestamp" },
        { status: 400 }
      );
    }
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "0.0.0.0";

  const { data: poll } = await supabaseAdmin
    .from("polls")
    .select("id, expires_at")
    .eq("id", parsed.data.pollId)
    .maybeSingle();

  if (!poll) {
    return NextResponse.json(
      { error: "Poll not found" },
      { status: 404 }
    );
  }

  if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
    return NextResponse.json(
      { status: "expired" },
      { status: 410 }
    );
  }

  const ipHash = hashValue(ip);
  const deviceHash = hashValue(parsed.data.fingerprint);

  const { data: existingVote } = await supabaseAdmin
    .from("votes")
    .select("id")
    .eq("poll_id", parsed.data.pollId)
    .eq("device_hash", deviceHash)
    .maybeSingle();

  if (existingVote) {
    return NextResponse.json(
      { status: "duplicate" },
      { status: 409 }
    );
  }

  const rateLimit = await rateLimitCheck({
    ipHash,
    pollId: parsed.data.pollId
  });

  // Check if vote should be allowed
  const trustCheck = checkVoteTrust({
    isNewDevice: !existingVote,
    cleanIp: rateLimit.trustDelta >= 0,
    behaviorScore: parsed.data.behaviorScore ?? 0,
    verified: parsed.data.verified ?? false,
    hasRateLimitIssue: rateLimit.cooldownMs > 0
  });

  if (!trustCheck.allowed) {
    return NextResponse.json(
      {
        status: "rejected",
        reason: trustCheck.reason,
        cooldownMs: rateLimit.cooldownMs
      },
      { status: 429 }
    );
  }

  const { error: voteError } = await supabaseAdmin.from("votes").insert({
    poll_id: parsed.data.pollId,
    option_id: parsed.data.optionId,
    ip_hash: ipHash,
    device_hash: deviceHash,
    trust_score: 100, // All allowed votes are trusted
    is_verified: parsed.data.verified ?? false
  });

  if (voteError) {
    return NextResponse.json(
      { error: voteError.message },
      { status: 500 }
    );
  }

  // Vote count is automatically incremented by database trigger
  // (see migrations/002_counts.sql)

  const { data: counts } = await supabaseAdmin
    .from("poll_counts")
    .select("option_id, vote_count")
    .eq("poll_id", parsed.data.pollId);

  if (counts) {
    const formattedCounts = counts.map((entry) => ({
      optionId: entry.option_id,
      count: Number(entry.vote_count)
    }));
    
    await publishPollUpdate({
      pollId: parsed.data.pollId,
      counts: formattedCounts
    });
  }

  return NextResponse.json({ status: "accepted" }, { status: 201 });
}
