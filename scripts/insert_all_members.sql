-- 구성원 관리 데이터 일괄 삽입/업데이트 스크립트
-- Supabase SQL Editor에서 실행하세요
-- ON CONFLICT를 사용하여 기존 데이터는 업데이트하고, 없는 데이터는 삽입합니다

-- 1. profiles 테이블 업데이트/삽입
INSERT INTO profiles (
    id,
    name,
    username,
    email,
    position,
    phone_number,
    address,
    birth_date,
    join_date,
    role
) VALUES
-- 1. 김춘근 (ck.kim) - 이미 존재
('66925239-1ffd-4798-b1ef-a8864e74e30b', '김춘근', 'ck.kim', 'ck.kim@rtb-kor.com', '부장', '010-6776-2829', '부산 기장군 정관읍 정관 4로 24 동일스위트1차 109동 1801호', TO_DATE('19691213', 'YYYYMMDD'), TO_DATE('20211102', 'YYYYMMDD'), 'staff'),

-- 2. 안재훈 (jh.an) - 이미 존재
('7ed9e907-f8b5-454c-a925-d12b705970ca', '안재훈', 'jh.an', 'jh.an@rtb-kor.com', '부장', '010-5131-2183', '부산 양산시 사송로155 롯데캐슬 804동 905호', TO_DATE('19700212', 'YYYYMMDD'), TO_DATE('20211102', 'YYYYMMDD'), 'staff'),

-- 3. 온권태 (kt.on) - 이미 존재
('ff3f25b3-6d3c-4a02-9186-af5245d2c808', '온권태', 'kt.on', 'kt.on@rtb-kor.com', '부장', '010-2867-4107', '울산광역시 동구 봉수로162, 204동 1209호', TO_DATE('19690215', 'YYYYMMDD'), TO_DATE('20220905', 'YYYYMMDD'), 'staff'),

-- 4. 정영철 (yc.jung) - 이미 존재
('ec990d35-dd8e-4859-9edb-0a17b2fa10d8', '정영철', 'yc.jung', 'yc.jung@rtb-kor.com', '부장', '010-6554-6856', '경남 양산시 양주로 154,112동 601호', TO_DATE('19660901', 'YYYYMMDD'), TO_DATE('20220203', 'YYYYMMDD'), 'staff'),

-- 5. 김희규 (hg.kim) - 이미 존재
('ec0f6384-8e46-4617-9ded-d3afedd9ee5f', '김희규', 'hg.kim', 'hg.kim@rtb-kor.com', '부장', '010-3226-5466', '창원시 마산회원구 석전 북2길 64, 나동 1702호', TO_DATE('19820216', 'YYYYMMDD'), TO_DATE('20230407', 'YYYYMMDD'), 'staff'),

-- 6. 이효익 (hi.lee) - 이미 존재
('3ca503e5-f90e-427c-a520-e82e7cdf1db1', '이효익', 'hi.lee', 'hi.lee@rtb-kor.com', '차장', '010-8589-9739', '경남 창원시 성산구 원이대로 774 성원아파트 201동 606호', TO_DATE('19801211', 'YYYYMMDD'), TO_DATE('20211202', 'YYYYMMDD'), 'staff'),

-- 7. 정상민 (sm.jung) - 이미 존재
('27517170-4620-4af5-9a8e-b25ad4466ecf', '정상민', 'sm.jung', 'sm.jung@rtb-kor.com', '차장', '010-4795-3248', '경남 창원시 성산구 원이대로 774 성원아파트 204동 2001호', TO_DATE('19810922', 'YYYYMMDD'), TO_DATE('20211229', 'YYYYMMDD'), 'staff'),

-- 8. 우상윤 (sy.woo) - 이미 존재
('56e9dadf-1119-40f3-a065-a07015c1c35a', '우상윤', 'sy.woo', 'sy.woo@rtb-kor.com', '차장', '010-2616-9463', '경남 거제시 신현읍 고현리 994 동현 아파트 101동 1106호', TO_DATE('19751105', 'YYYYMMDD'), TO_DATE('20240919', 'YYYYMMDD'), 'staff'),

-- 9. 성기형 (kh.sung) - 이미 존재
('c43ff355-37d0-4b23-9a87-063e0e38da2e', '성기형', 'kh.sung', 'kh.sung@rtb-kor.com', '차장', '010-4876-7517', '울산광역시 울주군 범서읍 입암 1길 37-1', TO_DATE('19800902', 'YYYYMMDD'), TO_DATE('20241007', 'YYYYMMDD'), 'staff'),

-- 10. 김동민 (dm.kim) - 이미 존재
('b8d54984-b507-4665-8db4-9f9fcfdcceb2', '김동민', 'dm.kim', 'dm.kim@rtb-kor.com', '차장', '010-9982-3412', '울산광역시 동구 남목12길 17 남목현대아파트 102동 1202호', TO_DATE('19840412', 'YYYYMMDD'), TO_DATE('20220902', 'YYYYMMDD'), 'staff'),

-- 11. 손재진 (jj.son) - 이미 존재
('c7ebc173-ae21-4420-bbaf-341c6a7dda01', '손재진', 'jj.son', 'jj.son@rtb-kor.com', '차장', '010-4163-5595', '경남 창원시 성산구 대정로 84. 202동 509호(남양동, 피오르빌아파트)', TO_DATE('19761226', 'YYYYMMDD'), TO_DATE('20230607', 'YYYYMMDD'), 'staff'),

-- 12. 류성관 (sg.ryu) - 이미 존재
('0a10559a-4366-4a0f-b30f-3921dc9ef4b2', '류성관', 'sg.ryu', 'sg.ryu@rtb-kor.com', '차장', '010-2838-6253', '경남 창원시 진해구 중원동로 19', TO_DATE('19771017', 'YYYYMMDD'), TO_DATE('20230403', 'YYYYMMDD'), 'staff'),

-- 13. 고두형 (brian.ko) - 이미 존재, 이름 업데이트 필요
('01b7a98e-e11d-45ba-9ec9-118f20e561bd', '고두형', 'brian.ko', 'brian.ko@rtb-kor.com', '대리', '010-8399-5721', '경상남도 김해시 가락로 242-20, 207동 1201호', TO_DATE('19900928', 'YYYYMMDD'), TO_DATE('20230822', 'YYYYMMDD'), 'staff'),

-- 14. 조용남 (yn.cho) - 이미 존재
('6c4c80e6-2aa1-4b1e-bf81-908fa82832a2', '조용남', 'yn.cho', 'yn.cho@rtb-kor.com', '대리', '010-4159-0745', '창원시 진해구 웅천동로 16,105동 802호(남문동, 남문시티프라디움 1차 아파트)', TO_DATE('19880503', 'YYYYMMDD'), TO_DATE('20230822', 'YYYYMMDD'), 'staff'),

-- 15. 이종훈 (jh.lee) - 이미 존재
('1054dbe5-f4a7-44a5-a328-1092c120fad3', '이종훈', 'jh.lee', 'jh.lee@rtb-kor.com', '대리', '010-2106-6682', '경상남도 창원시 진해구 적도로 60,305동 204호(석동,벚꽃그린빌주공3단지)', TO_DATE('19771026', 'YYYYMMDD'), TO_DATE('20231016', 'YYYYMMDD'), 'staff'),

-- 16. 박영성 (ys.park) - 이미 존재
('f43f7410-7d08-4497-b6a4-6ef0a5d13af0', '박영성', 'ys.park', 'ys.park@rtb-kor.com', '주임', '010-4914-0781', '부산 북구 효열로 37번길 22,503동 1304호', TO_DATE('19981122', 'YYYYMMDD'), TO_DATE('20240502', 'YYYYMMDD'), 'staff'),

-- 17. 문채훈 (ch.moon) - 이미 존재
('8786201f-cf65-4bbb-b3d7-c90dbbb1a9b5', '문채훈', 'ch.moon', 'ch.moon@rtb-kor.com', '주임', '010-2594-1419', '부산 사상구 대동로 148-29,2동 2711호 (학장동,1차 삼성아파트)', TO_DATE('19761125', 'YYYYMMDD'), TO_DATE('20240919', 'YYYYMMDD'), 'staff'),

-- 18. 박민욱 (mw.park) - 새로 추가 필요 (auth.users에 먼저 생성 필요)
-- ('USER_ID_박민욱', '박민욱', 'mw.park', 'mw.park@rtb-kor.com', '주임', '010-4282-5040', '경상남도 창원시 진해구 용원 중로5번길 8-17,201호', TO_DATE('19951105', 'YYYYMMDD'), TO_DATE('20240919', 'YYYYMMDD'), 'staff'),

-- 19. 김민규 (mg.kim) - 이미 존재
('246f9e8b-a46c-4d0d-8b2e-11dfd5fcd341', '김민규', 'mg.kim', 'mg.kim@rtb-kor.com', '주임', '010-2019-0031', '경상남도 창원시 성산구 용지로 229,7동 508호', TO_DATE('19980901', 'YYYYMMDD'), TO_DATE('20241104', 'YYYYMMDD'), 'staff'),

-- 20. 김상민 (sm.kim) - 이미 존재
('ef08a1e4-a85e-43ef-a04f-8bb02f8e28ab', '김상민', 'sm.kim', 'sm.kim@rtb-kor.com', '주임', '010-4147-4859', '창원시 마산회원구 석전북2길 64 가동 608호', TO_DATE('19840110', 'YYYYMMDD'), TO_DATE('20250203', 'YYYYMMDD'), 'staff'),

-- 25. 강민지 (mj.kang) - 인턴 (auth.users에 먼저 생성 필요)
-- ('USER_ID_강민지', '강민지', 'mj.kang', 'mj.kang@rtb-kor.com', '인턴', '010-9963-0772', '부산광역시 금강로 131번길 42 206동 1005호', TO_DATE('20070718', 'YYYYMMDD'), TO_DATE('20251117', 'YYYYMMDD'), 'staff'),

-- 21. 김지연 (jay.kim) - 이미 존재
('3e602998-a6b9-4c59-87f9-b81997392ad6', '김지연', 'jay.kim', 'jay.kim@rtb-kor.com', '대리', '010-3433-5755', '부산시 강서구 명지국제5로 60 108동 1203호(에일린의뜰)', TO_DATE('19821105', 'YYYYMMDD'), TO_DATE('20250310', 'YYYYMMDD'), 'staff'),

-- 23. 김영 (y.k) - 이미 존재
('62da12a4-8677-44f3-a1c8-09d6b635c322', '김영', 'y.k', 'y.k@rtb-kor.com', '대표', '010-9958-4156', '부산광역시 명지오션시티 10로 114(삼정그린코아 106동 202호)', TO_DATE('19800720', 'YYYYMMDD'), TO_DATE('20210402', 'YYYYMMDD'), 'admin'),

-- 24. 김현지 (hj.kim) - 이미 존재
('b75eb52d-c594-4761-adb3-df8c0a7ddd98', '김현지', 'hj.kim', 'hj.kim@rtb-kor.com', '감사', '010-2533-0106', '부산광역시 명지오션시티 10로 114(삼정그린코아 106동 203호)', TO_DATE('19790106', 'YYYYMMDD'), TO_DATE('20230302', 'YYYYMMDD'), 'staff'),

-- 25. 강민지 (mj.kang) - 인턴 (auth.users에 먼저 생성 필요)
-- ('USER_ID_강민지', '강민지', 'mj.kang', 'mj.kang@rtb-kor.com', '인턴', '010-9963-0772', '부산광역시 금강로 131번길 42 206동 1005호', TO_DATE('20070718', 'YYYYMMDD'), TO_DATE('20251117', 'YYYYMMDD'), 'staff')

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    position = EXCLUDED.position,
    phone_number = EXCLUDED.phone_number,
    address = EXCLUDED.address,
    birth_date = EXCLUDED.birth_date,
    join_date = EXCLUDED.join_date,
    role = EXCLUDED.role;

-- 2. profile_passports 테이블 업데이트/삽입
INSERT INTO profile_passports (
    user_id,
    passport_last_name,
    passport_first_name,
    passport_number,
    passport_expiry_date
) VALUES
-- 1. 김춘근
('66925239-1ffd-4798-b1ef-a8864e74e30b', 'KIM', 'CHUNKEUN', 'M23982606', TO_DATE('20290522', 'YYYYMMDD')),

-- 2. 안재훈
('7ed9e907-f8b5-454c-a925-d12b705970ca', 'AHN', 'JAEHUN', 'M580W5666', TO_DATE('20350618', 'YYYYMMDD')),

-- 3. 온권태
('ff3f25b3-6d3c-4a02-9186-af5245d2c808', 'ON', 'KWONTAE', 'M905P3962', TO_DATE('20330524', 'YYYYMMDD')),

-- 4. 정영철
('ec990d35-dd8e-4859-9edb-0a17b2fa10d8', 'JEONG', 'YEONGCHEOL', 'M14356142', TO_DATE('20260901', 'YYYYMMDD')),

-- 5. 김희규 (여권번호 없음)
('ec0f6384-8e46-4617-9ded-d3afedd9ee5f', 'KIM', 'HUIGYU', NULL, TO_DATE('20321230', 'YYYYMMDD')),

-- 6. 이효익 (여권번호 없음)
('3ca503e5-f90e-427c-a520-e82e7cdf1db1', 'LEE', 'HYOIK', NULL, TO_DATE('20311125', 'YYYYMMDD')),

-- 7. 정상민 (여권번호 없음)
('27517170-4620-4af5-9a8e-b25ad4466ecf', 'JUNG', 'SANGMIN', NULL, TO_DATE('20270712', 'YYYYMMDD')),

-- 8. 우상윤 (여권번호 없음)
('56e9dadf-1119-40f3-a065-a07015c1c35a', 'WOO', 'SANGYOON', NULL, TO_DATE('20270718', 'YYYYMMDD')),

-- 9. 성기형 (여권번호 없음)
('c43ff355-37d0-4b23-9a87-063e0e38da2e', 'SUNG', 'KIHYOUNG', NULL, TO_DATE('20300814', 'YYYYMMDD')),

-- 10. 김동민 (여권번호 없음)
('b8d54984-b507-4665-8db4-9f9fcfdcceb2', 'KIM', 'DONGMIN', NULL, TO_DATE('20320426', 'YYYYMMDD')),

-- 11. 손재진 (여권번호 없음)
('c7ebc173-ae21-4420-bbaf-341c6a7dda01', 'SON', 'JAEJIN', NULL, TO_DATE('20320304', 'YYYYMMDD')),

-- 12. 류성관 (여권번호 없음)
('0a10559a-4366-4a0f-b30f-3921dc9ef4b2', 'LYU', 'SEONGKWAN', NULL, TO_DATE('20330720', 'YYYYMMDD')),

-- 13. 고두형 (brian.ko) (여권번호 없음)
('01b7a98e-e11d-45ba-9ec9-118f20e561bd', 'KO', 'DUHYEONG BRIAN', NULL, TO_DATE('20270608', 'YYYYMMDD')),

-- 14. 조용남 (여권번호 없음)
('6c4c80e6-2aa1-4b1e-bf81-908fa82832a2', 'CHO', 'YONGNAM', NULL, TO_DATE('20330817', 'YYYYMMDD')),

-- 15. 이종훈 (여권번호 없음)
('1054dbe5-f4a7-44a5-a328-1092c120fad3', 'LEE', 'JONGHUN', NULL, TO_DATE('20331006', 'YYYYMMDD')),

-- 16. 박영성 (여권번호 없음)
('f43f7410-7d08-4497-b6a4-6ef0a5d13af0', 'PARK', 'YOUNGSEONG', NULL, TO_DATE('20341006', 'YYYYMMDD')),

-- 17. 문채훈 (여권번호 없음)
('8786201f-cf65-4bbb-b3d7-c90dbbb1a9b5', 'MOON', 'CHAEHOON', NULL, TO_DATE('20280601', 'YYYYMMDD')),

-- 19. 김민규 (여권번호 없음)
('246f9e8b-a46c-4d0d-8b2e-11dfd5fcd341', 'KIM', 'MINGYU', NULL, TO_DATE('20290731', 'YYYYMMDD')),

-- 20. 김상민 (여권번호 없음)
('ef08a1e4-a85e-43ef-a04f-8bb02f8e28ab', 'KIM', 'SANGMIN', NULL, TO_DATE('20340115', 'YYYYMMDD')),

-- 23. 김영 (y.k)
('62da12a4-8677-44f3-a1c8-09d6b635c322', 'KIM', 'YOUNG', NULL, TO_DATE('20310803', 'YYYYMMDD')),

-- 24. 김현지 (hj.kim)
('b75eb52d-c594-4761-adb3-df8c0a7ddd98', 'KIM', 'HYUNJI', NULL, TO_DATE('20281005', 'YYYYMMDD')),

-- 25. 강민지 (mj.kang) - 인턴 (auth.users에 먼저 생성 필요)
-- ('USER_ID_강민지', 'KANG', 'MINJI', NULL, NULL)

ON CONFLICT (user_id) DO UPDATE SET
    passport_last_name = EXCLUDED.passport_last_name,
    passport_first_name = EXCLUDED.passport_first_name,
    passport_number = EXCLUDED.passport_number,
    passport_expiry_date = EXCLUDED.passport_expiry_date;

-- 결과 확인
SELECT 
    p.name,
    p.username,
    p.position,
    p.phone_number,
    p.address,
    pp.passport_number,
    pp.passport_expiry_date,
    pp.passport_last_name,
    pp.passport_first_name,
    TO_CHAR(p.birth_date, 'YYMMDD') as birth_date,
    TO_CHAR(p.join_date, 'YYMMDD') as join_date
FROM profiles p
LEFT JOIN profile_passports pp ON p.id = pp.user_id
ORDER BY p.join_date, p.position, p.name;

