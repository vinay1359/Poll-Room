import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(
  _request: Request,
  props: { params: Promise<{ pollId: string }> }
) {
  const params = await props.params;
  const pollId = params.pollId;
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: votes, error } = await supabaseAdmin
    .from("votes")
    .select("created_at")
    .eq("poll_id", pollId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const buckets = new Map<string, number>();
  (votes ?? []).forEach((vote) => {
    const date = new Date(vote.created_at);
    date.setSeconds(0, 0);
    const key = date.toISOString();
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });

  const timeline = Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([time, count]) => ({ time, count }));

  return NextResponse.json({ timeline });
}
