interface TrustCheckInput {
  isNewDevice: boolean;
  cleanIp: boolean;
  behaviorScore: number;
  verified: boolean;
  hasRateLimitIssue: boolean;
}

interface TrustCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkVoteTrust(input: TrustCheckInput): TrustCheckResult {
  // Hard blocks - immediate rejection
  if (input.hasRateLimitIssue) {
    return {
      allowed: false,
      reason: "Too many requests from your IP address. Please wait a few minutes and try again."
    };
  }

  // Behavior checks - detect bots
  // Score >= 7 requires BOTH time AND movement (real human behavior)
  // - 3 sec + 3 moves = 6 points (rejected)
  // - 4 sec + 3 moves = 7 points (accepted)
  // - 5 sec + 2 moves = 8 points (accepted)
  if (input.behaviorScore < 7) {
    return {
      allowed: false,
      reason: "Please spend a moment reading the poll and make your selection carefully."
    };
  }

  // All checks passed
  return { allowed: true };
}
