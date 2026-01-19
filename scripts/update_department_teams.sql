-- 팀 구분 일괄 업데이트 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 공무팀 구성원
-- 1. 박민욱
UPDATE profiles
SET department = '공무팀'
WHERE name = '박민욱';

-- 2. 김영
UPDATE profiles
SET department = '공무팀'
WHERE name = '김영';

-- 3. 강민지
UPDATE profiles
SET department = '공무팀'
WHERE name = '강민지';

-- 4. 김지연
UPDATE profiles
SET department = '공무팀'
WHERE name = '김지연';

-- 5. 고두형
UPDATE profiles
SET department = '공무팀'
WHERE name = '고두형';

-- 6. 김희규
UPDATE profiles
SET department = '공무팀'
WHERE name = '김희규';

-- 7. 김현지
UPDATE profiles
SET department = '공무팀'
WHERE name = '김현지';

-- 나머지 모두 공사팀으로 설정
UPDATE profiles
SET department = '공사팀'
WHERE name NOT IN ('박민욱', '김영', '강민지', '김지연', '고두형', '김희규', '김현지')
AND department IS DISTINCT FROM '공사팀';

-- 결과 확인
SELECT 
    name,
    username,
    position,
    department,
    CASE 
        WHEN department = '공무팀' THEN '✅ 공무팀'
        WHEN department = '공사팀' THEN '✅ 공사팀'
        ELSE '⚠️ 미할당'
    END as team_status
FROM profiles
ORDER BY 
    CASE department
        WHEN '공무팀' THEN 1
        WHEN '공사팀' THEN 2
        ELSE 3
    END,
    name;

