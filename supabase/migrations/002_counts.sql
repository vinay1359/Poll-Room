-- Trigger function to increment vote count
create or replace function increment_poll_count()
returns trigger as $$
begin
  update poll_counts
  set vote_count = vote_count + 1
  where poll_id = new.poll_id and option_id = new.option_id;
  return new;
end;
$$ language plpgsql;

-- Drop existing trigger if it exists
drop trigger if exists votes_increment_poll_count on votes;

-- Create trigger that fires after each vote insert
create trigger votes_increment_poll_count
after insert on votes
for each row execute function increment_poll_count();

-- Add comment for documentation
comment on function increment_poll_count() is 'Automatically increment poll_counts.vote_count when a vote is inserted';
