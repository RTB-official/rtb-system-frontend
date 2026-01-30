-- TBM multi-select columns for process/hazard/measure

alter table tbm
  add column if not exists process_items text[],
  add column if not exists hazard_items text[],
  add column if not exists measure_items text[];

-- Backfill from legacy single-value fields
update tbm
set
  process_items = case
    when process_items is null and process is not null and length(process) > 0
      then array[process]
    else process_items
  end,
  hazard_items = case
    when hazard_items is null and hazard is not null and length(hazard) > 0
      then array[hazard]
    else hazard_items
  end,
  measure_items = case
    when measure_items is null and measure is not null and length(measure) > 0
      then array[measure]
    else measure_items
  end;
