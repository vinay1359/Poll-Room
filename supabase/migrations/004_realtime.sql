-- Enable realtime replication for poll_counts table
-- This allows Supabase Realtime to listen to changes on this table

alter publication supabase_realtime add table poll_counts;

-- Set replica identity to FULL so that old values are included in the replication stream
-- This is needed for realtime subscriptions to get the complete row data
alter table poll_counts replica identity full;
