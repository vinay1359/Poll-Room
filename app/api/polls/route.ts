import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseServer";

const pollSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(10),
  expiresAt: z.string().datetime().optional()
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = pollSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { question, options, expiresAt } = parsed.data;

  const { data: poll, error: pollError } = await supabaseAdmin
    .from("polls")
    .insert({ question, expires_at: expiresAt ?? null })
    .select("id")
    .single();

  if (pollError || !poll) {
    return NextResponse.json(
      { error: pollError?.message ?? "Failed to create poll" },
      { status: 500 }
    );
  }

  const optionRows = options.map((label, index) => ({
    poll_id: poll.id,
    label,
    sort_order: index
  }));

  const { data: insertedOptions, error: optionsError } = await supabaseAdmin
    .from("poll_options")
    .insert(optionRows)
    .select("id");

  if (optionsError || !insertedOptions) {
    return NextResponse.json(
      { error: optionsError?.message ?? "Failed to create options" },
      { status: 500 }
    );
  }

  const countRows = insertedOptions.map((option) => ({
    poll_id: poll.id,
    option_id: option.id,
    vote_count: 0
  }));

  const { error: countsError } = await supabaseAdmin
    .from("poll_counts")
    .insert(countRows);

  if (countsError) {
    return NextResponse.json(
      { error: countsError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ pollId: poll.id }, { status: 201 });
}

export async function GET() {
  const { data: polls, error } = await supabaseAdmin
    .from("polls")
    .select("id, question, created_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const pollList = polls ?? [];
  const pollIds = pollList.map((poll) => poll.id);
  if (pollIds.length === 0) {
    return NextResponse.json({ polls: [] });
  }

  const { data: counts } = await supabaseAdmin
    .from("poll_counts")
    .select("poll_id, vote_count")
    .in("poll_id", pollIds);

  const totals = new Map<string, number>();
  (counts ?? []).forEach((entry) => {
    totals.set(entry.poll_id, (totals.get(entry.poll_id) ?? 0) + Number(entry.vote_count));
  });

  const enriched = pollList.map((poll) => ({
    ...poll,
    total_votes: totals.get(poll.id) ?? 0
  }));

  return NextResponse.json({ polls: enriched });
}
