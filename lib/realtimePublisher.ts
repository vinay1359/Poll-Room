export async function publishPollUpdate(payload: {
  pollId: string;
  counts: Array<{ optionId: string; count: number }>;}) {
  const realtimeUrl = process.env.REALTIME_URL ?? process.env.NEXT_PUBLIC_REALTIME_URL;
  if (!realtimeUrl) {
    return;
  }

  try {
    await fetch(`${realtimeUrl}/emit`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "poll_update",
        pollId: payload.pollId,
        counts: payload.counts
      })
    });
  } catch (error) {
    // Silently fail - real-time updates are not critical
  }
}
