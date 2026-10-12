-- 이동 엔트리의 경유지. 경유가 없으면 null. 현재 값은 강동동 공장.
ALTER TABLE public.work_log_entries
ADD COLUMN IF NOT EXISTS move_via TEXT;

COMMENT ON COLUMN public.work_log_entries.move_via IS
    '이동 엔트리 경유지. 경유가 없으면 null. 현재 값은 강동동 공장.';

-- 상세 문장에만 남아 있던 강동동 공장 경유를 컬럼으로 채운다.
UPDATE public.work_log_entries
SET move_via = '강동동 공장'
WHERE desc_type = '이동'
  AND move_via IS NULL
  AND (
    details LIKE '%→강동동 공장→%'
    OR details LIKE '%->강동동 공장->%'
  );
