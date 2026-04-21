-- 자정 분할로 나뉜 work_log_entries 행을 묶어 상세·인원·유형 동기화에 사용
ALTER TABLE work_log_entries
ADD COLUMN IF NOT EXISTS split_group_id TEXT;

COMMENT ON COLUMN work_log_entries.split_group_id IS
    'Same UUID for segments created from one multi-day entry (midnight split); optional for legacy rows.';
