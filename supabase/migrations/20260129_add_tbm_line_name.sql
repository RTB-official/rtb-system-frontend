-- Add line name (호선명) to TBM
alter table tbm
  add column if not exists line_name text;
