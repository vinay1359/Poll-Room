import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RouteContext {
  params: { pollId: string };
}

export async function GET(request: Request, context: RouteContext) {
  const pollId = context.params.pollId;

  const { data: poll, error: pollError } = await supabaseAdmin
    .from("polls")
    .select("id, question, created_at, expires_at")
    .eq("id", pollId)
    .maybeSingle();

  if (pollError || !poll) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  const { data: options } = await supabaseAdmin
    .from("poll_options")
    .select("id, label, sort_order")
    .eq("poll_id", pollId)
    .order("sort_order", { ascending: true });

  const { data: counts } = await supabaseAdmin
    .from("poll_counts")
    .select("option_id, vote_count")
    .eq("poll_id", pollId);

  return NextResponse.json({ poll, options: options ?? [], counts: counts ?? [] });
}
