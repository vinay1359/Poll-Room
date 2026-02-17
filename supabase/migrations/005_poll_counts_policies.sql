-- Add UPDATE and INSERT policies for poll_counts
-- The database trigger needs to update poll_counts when votes are inserted

-- Allow INSERT (for initial poll creation)
create policy "allow insert poll counts" on poll_counts
  for insert 
  with check (true);

-- Allow UPDATE (for vote count increments via trigger)
create policy "allow update poll counts" on poll_counts
  for update
  using (true)
  with check (true);

-- Add index for faster queries on poll_id
create index if not exists idx_poll_counts_poll_id on poll_counts(poll_id);
