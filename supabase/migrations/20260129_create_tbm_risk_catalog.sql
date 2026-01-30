-- Seed: processes + hazards + measures (reset catalog)
delete from tbm_measures;
delete from tbm_hazards;
delete from tbm_processes;

insert into tbm_processes (code, name, sort_order)
values
  ('P1', '분해조립(기본)', 10),
  ('P2', '유압', 20),
  ('P3', '챔버', 30),
  ('P4', '절단/화기', 40)
on conflict (code) do nothing;

-- 분해조립(기본) 위험요인
with p as (
  select id from tbm_processes where code = 'P1' limit 1
),
haz as (
  insert into tbm_hazards (process_id, code, name, sort_order)
  values
    ((select id from p), 'P1-H01', '체인블럭 사용 중 자재 추락 위험', 10),
    ((select id from p), 'P1-H02', '크레인 사용 중 자재 추락 위험', 20),
    ((select id from p), 'P1-H03', '슬링 벨트파손으로 인한 자재 추락 위험', 30),
    ((select id from p), 'P1-H04', '세척제 낙하 또는 튐으로 인한 신체접촉 (눈, 입, 피부 등)의 위험', 40),
    ((select id from p), 'P1-H05', '바닥 유분 및 세척제 잔유로 인한 미끄러짐의 위험', 50),
    ((select id from p), 'P1-H06', '공간 협소로 인한 작업시 구조물과의 간섭', 60),
    ((select id from p), 'P1-H07', '수동공구 사용시 미끄럼으로 인한 찰과상 위험', 70),
    ((select id from p), 'P1-H08', '전동공구 사용 시 회전부 손말림, 끼임 사고의 위험', 80),
    ((select id from p), 'P1-H09', '조립 중 부품(자재)추락에 의한 부상의 위험', 90),
    ((select id from p), 'P1-H10', '조립 중 소음·진동 노출에 의한 위험', 100),
    ((select id from p), 'P1-H11', '전동공구 과열로 인한 화상 및 화재 위험', 110),
    ((select id from p), 'P1-H12', '잔유로 인한 미끄럼 위험', 120),
    ((select id from p), 'P1-H13', '각종 케이블 및 호스 등 정리 미흡으로 인한 걸림 사고의 위험', 130),
    ((select id from p), 'P1-H14', '작업 후 공구 및 자재에 의한 넘어짐의 위험', 140),
    ((select id from p), 'P1-H15', '무거운 자재 운반으로 인한 신체 부상의 위험', 150),
    ((select id from p), 'P1-H16', '낙하로 인한 부상의 위험', 160),
    ((select id from p), 'P1-H17', '장비 충돌 및 안전통로 침범', 170)
  returning id, code
)
insert into tbm_measures (hazard_id, code, name, sort_order)
values
  ((select id from haz where code = 'P1-H01'), 'P1-H01-M01', '작업 전 체인블럭 상태 점검(체인, 브레이크, 훅, 안전핀 이상 여부 확인)', 10),
  ((select id from haz where code = 'P1-H01'), 'P1-H01-M02', '권상·하강 구역 하부 출입 금지', 20),
  ((select id from haz where code = 'P1-H01'), 'P1-H01-M03', '체인블럭 정격 하중 준수 및 권상 각도 확인', 30),
  ((select id from haz where code = 'P1-H01'), 'P1-H01-M04', '비숙련자 작업 금지', 40),

  ((select id from haz where code = 'P1-H02'), 'P1-H02-M01', '자재 부양·이동 중 하부 출입 금지', 10),
  ((select id from haz where code = 'P1-H02'), 'P1-H02-M02', '신호수와 크레인 조작자 간 수신호 철저(복명·복창 실시)', 20),
  ((select id from haz where code = 'P1-H02'), 'P1-H02-M03', '작업 전 크레인 및 장비 상태 점검(와이어, 훅, 브레이크, 안전장치 이상 여부 확인)', 30),
  ((select id from haz where code = 'P1-H02'), 'P1-H02-M04', '적재물 고정 및 균형 확인, 권상 각도·속도 조절', 40),
  ((select id from haz where code = 'P1-H02'), 'P1-H02-M05', '작업 구역 안전 확보 및 위험구역 표시', 50),
  ((select id from haz where code = 'P1-H02'), 'P1-H02-M06', '비숙련자 작업 금지', 60),

  ((select id from haz where code = 'P1-H03'), 'P1-H03-M01', '작업 전 슬링벨트 육안 검사 실시', 10),
  ((select id from haz where code = 'P1-H03'), 'P1-H03-M02', '슬링벨트 간 연결/매듭 금지', 20),
  ((select id from haz where code = 'P1-H03'), 'P1-H03-M03', 'Sharp edge 부위 보호패드 사용으로 끊어짐 방지', 30),
  ((select id from haz where code = 'P1-H03'), 'P1-H03-M04', '부재 권상 시 훅에 걸리는 슬링 각도 120도 초과 금지', 40),
  ((select id from haz where code = 'P1-H03'), 'P1-H03-M05', '슬링벨트 적정 하중 준수 및 손상·마모 여부 점검', 50),
  ((select id from haz where code = 'P1-H03'), 'P1-H03-M06', '비숙련자 작업 금지', 60),
  ((select id from haz where code = 'P1-H03'), 'P1-H03-M07', '작업 구역 안전 확보 및 하부 출입 금지', 70),

  ((select id from haz where code = 'P1-H04'), 'P1-H04-M01', '개인 보호구(보안경, 마스크, 보호복 등)착용 철저', 10),

  ((select id from haz where code = 'P1-H05'), 'P1-H05-M01', '잔유 발견시 즉각 클리닝 실시', 10),
  ((select id from haz where code = 'P1-H05'), 'P1-H05-M02', '미끄럼 주의 표지 및 구역 통제 철저', 20),

  ((select id from haz where code = 'P1-H06'), 'P1-H06-M01', '안정적 시야 확보를 위한 주변 돌출물 제거 후 작업', 10),
  ((select id from haz where code = 'P1-H06'), 'P1-H06-M02', '작업 공간 적정 조도 확보', 20),
  ((select id from haz where code = 'P1-H06'), 'P1-H06-M03', '협소 공간 진입 전 위험 요소 확인', 30),
  ((select id from haz where code = 'P1-H06'), 'P1-H06-M04', '개인 안전장구 착용 철저(안전모, 안전화 등)', 40),
  ((select id from haz where code = 'P1-H06'), 'P1-H06-M05', '작업 중 구조물에 부딪힘 방지를 위한 보호재 설치', 50),
  ((select id from haz where code = 'P1-H06'), 'P1-H06-M06', '공구·부재 이동 시 충돌 방지, 이동 경로 사전 확보', 60),

  ((select id from haz where code = 'P1-H07'), 'P1-H07-M01', '링스패너, 소켓류 등 볼트 완전 삽입 후 작업', 10),
  ((select id from haz where code = 'P1-H07'), 'P1-H07-M02', '손 위치 확인 및 고정 자세 유지', 20),
  ((select id from haz where code = 'P1-H07'), 'P1-H07-M03', '공구 손잡이·날 끝 마모·오염 여부 점검', 30),
  ((select id from haz where code = 'P1-H07'), 'P1-H07-M04', '장갑 착용(작업용 코팅장갑) 및 손 보호', 40),
  ((select id from haz where code = 'P1-H07'), 'P1-H07-M05', '공구 사용 전 윤활·청결 확인', 50),
  ((select id from haz where code = 'P1-H07'), 'P1-H07-M06', '작업 시 주변 장애물 제거 및 작업 공간 확보', 60),
  ((select id from haz where code = 'P1-H07'), 'P1-H07-M07', '작업 중 무리한 힘 사용 금지, 적정 토크 사용', 70),

  ((select id from haz where code = 'P1-H08'), 'P1-H08-M01', '면장갑 착용 금지, 코팅장갑 또는 전용 장갑 착용', 10),
  ((select id from haz where code = 'P1-H08'), 'P1-H08-M02', '소켓, 비트, 척 등 체결상태 확인 후 전원 연결', 20),
  ((select id from haz where code = 'P1-H08'), 'P1-H08-M03', '전원 차단 후 공구 교체 및 점검 실시', 30),
  ((select id from haz where code = 'P1-H08'), 'P1-H08-M04', '전동공구의 회전부 커버, 가드류 탈거 금지', 40),
  ((select id from haz where code = 'P1-H08'), 'P1-H08-M05', '파손·균열 공구 사용 금지 및 사용 전 육안검사 실시', 50),
  ((select id from haz where code = 'P1-H08'), 'P1-H08-M06', '사용 전 공구의 스위치 ''OFF'' 상태 확인 후 전원 연결', 60),

  ((select id from haz where code = 'P1-H09'), 'P1-H09-M01', '중량 부품 취급시 2인 1조 작업', 10),
  ((select id from haz where code = 'P1-H09'), 'P1-H09-M02', '부품 고정 철저', 20),
  ((select id from haz where code = 'P1-H09'), 'P1-H09-M03', '낙하방지용 매트 및 그물망 설치', 30),

  ((select id from haz where code = 'P1-H10'), 'P1-H10-M01', '귀마개 착용', 10),
  ((select id from haz where code = 'P1-H10'), 'P1-H10-M02', '장시간 노출 시 작업교대 실시', 20),

  ((select id from haz where code = 'P1-H11'), 'P1-H11-M01', '작업 중 정기적 휴식 및 장비 과열 점검', 10),

  ((select id from haz where code = 'P1-H12'), 'P1-H12-M01', '잔유 발견 시 즉시 클리닝 실시', 10),

  ((select id from haz where code = 'P1-H13'), 'P1-H13-M01', '전원선 및 케이블은 작업 종료 후 정리 및 고정', 10),

  ((select id from haz where code = 'P1-H14'), 'P1-H14-M01', '작업 완료 시 공구 및 자재 정리정돈', 10),
  ((select id from haz where code = 'P1-H14'), 'P1-H14-M02', '부재 운반 시 2인 1조 작업', 20),
  ((select id from haz where code = 'P1-H14'), 'P1-H14-M03', '공구 사용 후 지정된 위치에 정리', 30),
  ((select id from haz where code = 'P1-H14'), 'P1-H14-M04', '작업 공간 통로 확보 및 장애물 제거', 40),

  ((select id from haz where code = 'P1-H15'), 'P1-H15-M01', '2인 1조 운반 및 적절한 리프팅 도구 사용', 10),
  ((select id from haz where code = 'P1-H15'), 'P1-H15-M02', '충분한 스트레칭 실시', 20),
  ((select id from haz where code = 'P1-H15'), 'P1-H15-M03', '작업 전 안전교육 실시', 30),

  ((select id from haz where code = 'P1-H16'), 'P1-H16-M01', '자재 고정 및 이동 중 하부 출입 금지', 10),
  ((select id from haz where code = 'P1-H16'), 'P1-H16-M02', '체인블럭, 슬링벨트 상태 점검', 20),

  ((select id from haz where code = 'P1-H17'), 'P1-H17-M01', '안전 통로 확보 및 가이드 라인 설치(인원 통제)', 10),
  ((select id from haz where code = 'P1-H17'), 'P1-H17-M02', '신호수 배치', 20);

-- 유압 위험요인
with p as (
  select id from tbm_processes where code = 'P2' limit 1
),
haz as (
  insert into tbm_hazards (process_id, code, name, sort_order)
  values
    ((select id from p), 'P2-H01', '유압 호스 및 커넥터 결합 불량으로 인한 위험', 10),
    ((select id from p), 'P2-H02', '유압작업 장비 사용 미흡으로 인한 사고의 위험', 20)
  returning id, code
)
insert into tbm_measures (hazard_id, code, name, sort_order)
values
  ((select id from haz where code = 'P2-H01'), 'P2-H01-M01', '작업 전 호스, 커넥터, 펌프 상태 점검', 10),
  ((select id from haz where code = 'P2-H01'), 'P2-H01-M02', '보호 장갑, 장화, 보호안경 착용', 20),
  ((select id from haz where code = 'P2-H01'), 'P2-H01-M03', '비숙련자 작업 금지', 30),
  ((select id from haz where code = 'P2-H01'), 'P2-H01-M04', '누출 발생 시 즉시 압력 해제', 40),

  ((select id from haz where code = 'P2-H02'), 'P2-H02-M01', '정격 압력 준수 및 게이지 확인', 10),
  ((select id from haz where code = 'P2-H02'), 'P2-H02-M02', '작업 전 유압 장치 점검', 20),
  ((select id from haz where code = 'P2-H02'), 'P2-H02-M03', '허가자(숙련자)에 의한 장비 사용(운전)', 30),
  ((select id from haz where code = 'P2-H02'), 'P2-H02-M04', '작업 전 주변 케이블·호스 정리 및 고정', 40),
  ((select id from haz where code = 'P2-H02'), 'P2-H02-M05', '개인보호장구 착용 철저(안면보호구 및 보호장갑 등)', 50),
  ((select id from haz where code = 'P2-H02'), 'P2-H02-M06', '비숙련자 접근 금지', 60),
  ((select id from haz where code = 'P2-H02'), 'P2-H02-M07', '인원과 지속적인 소통으로 인한 유압유지 상태 확인(복면복창)', 70),
  ((select id from haz where code = 'P2-H02'), 'P2-H02-M08', '호스류 체결상태 상호간 확인', 80);

-- 챔버 위험요인
with p as (
  select id from tbm_processes where code = 'P3' limit 1
),
haz as (
  insert into tbm_hazards (process_id, code, name, sort_order)
  values
    ((select id from p), 'P3-H01', 'Chamber 작업 시 오일에 의한 미끄러 짐 및 추락, 질식및 화상의 위험', 10),
    ((select id from p), 'P3-H02', 'Turning gear 사용 시 신체 협착 및 끼임 위험', 20)
  returning id, code
)
insert into tbm_measures (hazard_id, code, name, sort_order)
values
  ((select id from haz where code = 'P3-H01'), 'P3-H01-M01', '작업 전 챔버 내부 오일 제거', 10),
  ((select id from haz where code = 'P3-H01'), 'P3-H01-M02', '라이프라인 설치 및 안전장구 착용 철저', 20),
  ((select id from haz where code = 'P3-H01'), 'P3-H01-M03', '미끄럼 방지를 위한 덧신 착용', 30),
  ((select id from haz where code = 'P3-H01'), 'P3-H01-M04', 'Chamber 내부 발판 설치 시 2인 1조 설치로 추락 방지', 40),
  ((select id from haz where code = 'P3-H01'), 'P3-H01-M05', '산소농도 측정기 사용 및 환기 시스템 확보', 50),
  ((select id from haz where code = 'P3-H01'), 'P3-H01-M06', '엔진 냉각 완료 후 실시', 60),
  ((select id from haz where code = 'P3-H01'), 'P3-H01-M07', '충분한 환기(송충) 실시', 70),

  ((select id from haz where code = 'P3-H02'), 'P3-H02-M01', '사용 전 Chamber 내부 인원 안전확보', 10),
  ((select id from haz where code = 'P3-H02'), 'P3-H02-M02', '보조 인력 배치로 신호전달체계 확보(복명복창)', 20),
  ((select id from haz where code = 'P3-H02'), 'P3-H02-M03', 'Turning gear 미사용 시 전원 항시 OFF', 30);

-- 절단/화기 위험요인
with p as (
  select id from tbm_processes where code = 'P4' limit 1
),
haz as (
  insert into tbm_hazards (process_id, code, name, sort_order)
  values
    ((select id from p), 'P4-H01', '작업준비 미비로 인한 사고 위험', 10),
    ((select id from p), 'P4-H02', '용접 중 발생하는 불꽃으로 인한 화재 위험', 20),
    ((select id from p), 'P4-H03', '용접 후 잔불 또는 고온부위 방치로 인한 재발화 위험', 30),
    ((select id from p), 'P4-H04', '불꽃 및 금속 파편에 의한 화재·화상 위험', 40),
    ((select id from p), 'P4-H05', '절단 장비(디스크, 절단석 등) 파손으로 인한 비산물 부상 위험', 50),
    ((select id from p), 'P4-H06', '화재·폭발 위험 (스파크 발생)', 60),
    ((select id from p), 'P4-H07', '소음·진동으로 인한 작업자 건강 위험', 70)
  returning id, code
)
insert into tbm_measures (hazard_id, code, name, sort_order)
values
  ((select id from haz where code = 'P4-H01'), 'P4-H01-M01', '작업 전 화기 작업 허가증 및 절차 확인', 10),
  ((select id from haz where code = 'P4-H01'), 'P4-H01-M02', '작업 구역에 위험 표지판 및 경고 표시 설치', 20),
  ((select id from haz where code = 'P4-H01'), 'P4-H01-M03', '방화 장비 및 안전 장구 점검', 30),
  ((select id from haz where code = 'P4-H01'), 'P4-H01-M04', '작업 전 M/E 유류공급 차단 확인', 40),
  ((select id from haz where code = 'P4-H01'), 'P4-H01-M05', '작업 전 주위 가연성 물질 제거 및 통제구역 확인', 50),

  ((select id from haz where code = 'P4-H02'), 'P4-H02-M01', '용접기 및 절단기 상태 점검(케이블, 가스류 등)', 10),
  ((select id from haz where code = 'P4-H02'), 'P4-H02-M02', '주변 가연성 물질 제거 및 안전구역 설정', 20),
  ((select id from haz where code = 'P4-H02'), 'P4-H02-M03', '방화포, 차열판 등으로 비산불꽃 차단', 30),
  ((select id from haz where code = 'P4-H02'), 'P4-H02-M04', '용접기 케이블, 전극선 상태 점검', 40),

  ((select id from haz where code = 'P4-H03'), 'P4-H03-M01', '작업 완료 후 잔불 및 고온부위 확인', 10),
  ((select id from haz where code = 'P4-H03'), 'P4-H03-M02', '작업 후 최소 30분 이상 화재감시자 배치', 20),
  ((select id from haz where code = 'P4-H03'), 'P4-H03-M03', '완전 냉각 확인 후 장비 및 자재 정리 정돈', 30),

  ((select id from haz where code = 'P4-H04'), 'P4-H04-M01', '절단 전 주변 가연성 물질 제거 및 방화포 설치', 10),
  ((select id from haz where code = 'P4-H04'), 'P4-H04-M02', '절단면 아래 소화기, 소화포 준비 및 감시자 배치', 20),

  ((select id from haz where code = 'P4-H05'), 'P4-H05-M01', '절단석 균열, 마모, 유효기간 확인 후 사용', 10),
  ((select id from haz where code = 'P4-H05'), 'P4-H05-M02', '절단기 커버 장착 및 비산방지 차폐판 설치', 20),
  ((select id from haz where code = 'P4-H05'), 'P4-H05-M03', '절단석 교체 시 전원 차단 및 완전 정지 확인', 30),
  ((select id from haz where code = 'P4-H05'), 'P4-H05-M04', '작업 전 그라인더 날 상태 점검', 40),
  ((select id from haz where code = 'P4-H05'), 'P4-H05-M05', '규격·재질 적합 날 사용', 50),
  ((select id from haz where code = 'P4-H05'), 'P4-H05-M06', '비숙련자 작업 금지', 60),

  ((select id from haz where code = 'P4-H06'), 'P4-H06-M01', '작업 전 주변 인화물질 제거', 10),
  ((select id from haz where code = 'P4-H06'), 'P4-H06-M02', '화재 감지기 및 소화기 준비', 20),
  ((select id from haz where code = 'P4-H06'), 'P4-H06-M03', '안전 방화포 사용', 30),

  ((select id from haz where code = 'P4-H07'), 'P4-H07-M01', '방진·방음 장비 착용', 10),
  ((select id from haz where code = 'P4-H07'), 'P4-H07-M02', '장시간 작업 시 휴식 시간 확보', 20),
  ((select id from haz where code = 'P4-H07'), 'P4-H07-M03', '장비 점검 및 진동·소음 최소화', 30);
