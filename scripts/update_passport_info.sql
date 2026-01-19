-- 여권정보 일괄 업데이트 스크립트
-- Supabase SQL Editor에서 실행하세요

-- profiles의 생년월일과 매칭하여 여권정보 업데이트

-- 1. 김춘근 (691213 -> 1969-12-13)
UPDATE profile_passports
SET 
  passport_number = 'M23982606',
  passport_expiry_date = TO_DATE('20290522', 'YYYYMMDD'),
  passport_last_name = 'KIM',
  passport_first_name = 'CHUNKEUN'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '691213' AND name = '김춘근'
);

-- 2. 안재훈 (700212 -> 1970-02-12)
UPDATE profile_passports
SET 
  passport_number = 'M580W5666',
  passport_expiry_date = TO_DATE('20350618', 'YYYYMMDD'),
  passport_last_name = 'AHN',
  passport_first_name = 'JAEHUN'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '700212' AND name = '안재훈'
);

-- 3. 온권태 (690215 -> 1969-02-15)
UPDATE profile_passports
SET 
  passport_number = 'M905P3962',
  passport_expiry_date = TO_DATE('20330524', 'YYYYMMDD'),
  passport_last_name = 'ON',
  passport_first_name = 'KWONTAE'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '690215' AND name = '온권태'
);

-- 4. 정영철 (660901 -> 1966-09-01)
UPDATE profile_passports
SET 
  passport_number = 'M14356142',
  passport_expiry_date = TO_DATE('20260901', 'YYYYMMDD'),
  passport_last_name = 'JEONG',
  passport_first_name = 'YEONGCHEOL'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '660901' AND name = '정영철'
);

-- 5. 김희규 (820216 -> 1982-02-16)
UPDATE profile_passports
SET 
  passport_number = 'M218K2067',
  passport_expiry_date = TO_DATE('20321230', 'YYYYMMDD'),
  passport_last_name = 'KIM',
  passport_first_name = 'HUIGYU'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '820216' AND name = '김희규'
);

-- 6. 이효익 (801211 -> 1980-12-11)
UPDATE profile_passports
SET 
  passport_number = 'M80014143',
  passport_expiry_date = TO_DATE('20311125', 'YYYYMMDD'),
  passport_last_name = 'LEE',
  passport_first_name = 'HYOIK'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '801211' AND name = '이효익'
);

-- 7. 정상민 (810922 -> 1981-09-22)
UPDATE profile_passports
SET 
  passport_number = 'M03590022',
  passport_expiry_date = TO_DATE('20270712', 'YYYYMMDD'),
  passport_last_name = 'JUNG',
  passport_first_name = 'SANGMIN'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '810922' AND name = '정상민'
);

-- 8. 우상윤 (751105 -> 1975-11-05)
UPDATE profile_passports
SET 
  passport_number = 'M69826629',
  passport_expiry_date = TO_DATE('20270718', 'YYYYMMDD'),
  passport_last_name = 'WOO',
  passport_first_name = 'SANGYOON'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '751105' AND name = '우상윤'
);

-- 9. 성기형 (800902 -> 1980-09-02)
UPDATE profile_passports
SET 
  passport_number = 'M97447977',
  passport_expiry_date = TO_DATE('20300814', 'YYYYMMDD'),
  passport_last_name = 'SUNG',
  passport_first_name = 'KIHYOUNG'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '800902' AND name = '성기형'
);

-- 10. 김동민 (840412 -> 1984-04-12)
UPDATE profile_passports
SET 
  passport_number = 'M836U3669',
  passport_expiry_date = TO_DATE('20320426', 'YYYYMMDD'),
  passport_last_name = 'KIM',
  passport_first_name = 'DONGMIN'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '840412' AND name = '김동민'
);

-- 11. 손재진 (761226 -> 1976-12-26)
UPDATE profile_passports
SET 
  passport_number = 'M803B7441',
  passport_expiry_date = TO_DATE('20320304', 'YYYYMMDD'),
  passport_last_name = 'SON',
  passport_first_name = 'JAEJIN'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '761226' AND name = '손재진'
);

-- 12. 류성관 (771017 -> 1977-10-17)
UPDATE profile_passports
SET 
  passport_number = 'M735W0950',
  passport_expiry_date = TO_DATE('20330720', 'YYYYMMDD'),
  passport_last_name = 'LYU',
  passport_first_name = 'SEONGKWAN'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '771017' AND name = '류성관'
);

-- 13. 고두형 (brian.ko) (900928 -> 1990-09-28)
UPDATE profile_passports
SET 
  passport_number = '560143621',
  passport_expiry_date = TO_DATE('20270608', 'YYYYMMDD'),
  passport_last_name = 'KO',
  passport_first_name = 'DUHYEONG BRIAN'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '900928' AND name = '고두형'
);

-- 14. 조용남 (880503 -> 1988-05-03)
UPDATE profile_passports
SET 
  passport_number = 'M982V5743',
  passport_expiry_date = TO_DATE('20330817', 'YYYYMMDD'),
  passport_last_name = 'CHO',
  passport_first_name = 'YONGNAM'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '880503' AND name = '조용남'
);

-- 15. 이종훈 (771026 -> 1977-10-26)
UPDATE profile_passports
SET 
  passport_number = 'M791U0716',
  passport_expiry_date = TO_DATE('20331006', 'YYYYMMDD'),
  passport_last_name = 'LEE',
  passport_first_name = 'JONGHUN'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '771026' AND name = '이종훈'
);

-- 16. 박영성 (981122 -> 1998-11-22)
UPDATE profile_passports
SET 
  passport_number = 'M403M7698',
  passport_expiry_date = TO_DATE('20341006', 'YYYYMMDD'),
  passport_last_name = 'PARK',
  passport_first_name = 'YOUNGSEONG'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '981122' AND name = '박영성'
);

-- 17. 문채훈 (761125 -> 1976-11-25)
UPDATE profile_passports
SET 
  passport_number = 'M48105900',
  passport_expiry_date = TO_DATE('20280601', 'YYYYMMDD'),
  passport_last_name = 'MOON',
  passport_first_name = 'CHAEHOON'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '761125' AND name = '문채훈'
);

-- 18. 박민욱 (951105 -> 1995-11-05)
UPDATE profile_passports
SET 
  passport_number = 'M07142534',
  passport_expiry_date = TO_DATE('20290408', 'YYYYMMDD'),
  passport_last_name = 'PARK',
  passport_first_name = 'MINWOOK'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '951105' AND name = '박민욱'
);

-- 19. 김민규 (980901 -> 1998-09-01)
UPDATE profile_passports
SET 
  passport_number = 'M95879819',
  passport_expiry_date = TO_DATE('20290731', 'YYYYMMDD'),
  passport_last_name = 'KIM',
  passport_first_name = 'MINGYU'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '980901' AND name = '김민규'
);

-- 20. 김상민 (840110 -> 1984-01-10)
UPDATE profile_passports
SET 
  passport_number = 'M850B9538',
  passport_expiry_date = TO_DATE('20340115', 'YYYYMMDD'),
  passport_last_name = 'KIM',
  passport_first_name = 'SANGMIN'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '840110' AND name = '김상민'
);

-- 21. 김지연 (jay.kim) (821105 -> 1982-11-05)
UPDATE profile_passports
SET 
  passport_number = 'M91258551',
  passport_expiry_date = TO_DATE('20271108', 'YYYYMMDD'),
  passport_last_name = 'KIM',
  passport_first_name = 'JIYEON'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '821105' AND name = '김지연'
);

-- 23. 김영 (y.k) (800720 -> 1980-07-20)
UPDATE profile_passports
SET 
  passport_number = 'M49154399',
  passport_expiry_date = TO_DATE('20310803', 'YYYYMMDD'),
  passport_last_name = 'KIM',
  passport_first_name = 'YOUNG'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '800720' AND name = '김영'
);

-- 24. 김현지 (hj.kim) (790106 -> 1979-01-06)
UPDATE profile_passports
SET 
  passport_number = 'M28354060',
  passport_expiry_date = TO_DATE('20281005', 'YYYYMMDD'),
  passport_last_name = 'KIM',
  passport_first_name = 'HYUNJI'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '790106' AND name = '김현지'
);

-- 25. 강민지 (mj.kang) (070718 -> 2007-07-18)
UPDATE profile_passports
SET 
  passport_number = 'M881L0306',
  passport_expiry_date = TO_DATE('20280125', 'YYYYMMDD'),
  passport_last_name = 'KANG',
  passport_first_name = 'MINJI'
WHERE user_id = (
  SELECT id FROM profiles WHERE TO_CHAR(birth_date, 'YYMMDD') = '070718' AND name = '강민지'
);

-- 결과 확인
SELECT 
    p.name,
    p.username,
    pp.passport_number,
    TO_CHAR(pp.passport_expiry_date, 'YY.MM.DD') as passport_expiry,
    pp.passport_last_name,
    pp.passport_first_name,
    TO_CHAR(p.birth_date, 'YYMMDD') as birth_date
FROM profiles p
LEFT JOIN profile_passports pp ON p.id = pp.user_id
WHERE pp.passport_number IS NOT NULL
ORDER BY p.join_date, p.position, p.name;

