-- '사원' 직급을 모두 '주임'으로 업데이트
-- Supabase SQL Editor에서 실행하세요

UPDATE profiles
SET position = '주임'
WHERE position = '사원';

-- 결과 확인
SELECT 
    name,
    username,
    position,
    join_date
FROM profiles
WHERE position = '주임'
ORDER BY join_date, name;

