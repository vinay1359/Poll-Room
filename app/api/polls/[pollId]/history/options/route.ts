import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

interface RouteContext {
  params: { pollId: string };
}

export async function GET(_request: Request, context: RouteContext) {
  const pollId = context.params.pollId;
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: options, error: optionsError } = await supabaseAdmin
    .from("poll_options")
    .select("id, label, sort_order")
    .eq("poll_id", pollId)
    .order("sort_order", { ascending: true });

  if (optionsError) {
    return NextResponse.json({ error: optionsError.message }, { status: 500 });
  }

  const { data: votes, error } = await supabaseAdmin
    .from("votes")
    .select("created_at, option_id")
    .eq("poll_id", pollId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(4000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const buckets = new Map<string, Record<string, number>>();
  (votes ?? []).forEach((vote) => {
    const date = new Date(vote.created_at);
    date.setSeconds(0, 0);
    const key = date.toISOString();
    const existing = buckets.get(key) ?? {};
    existing[vote.option_id] = (existing[vote.option_id] ?? 0) + 1;
    buckets.set(key, existing);
  });

  const timeline = Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([time, counts]) => ({ time, counts }));

  return NextResponse.json({
    options: options ?? [],
    timeline
  });
}
