# 휴가 관리 Supabase 데이터베이스 스키마

## 1. vacations 테이블 (휴가 신청 내역)

```sql
CREATE TABLE vacations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('FULL', 'AM', 'PM')), -- FULL: 하루 종일, AM: 오전 반차, PM: 오후 반차
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')), -- 대기 중, 승인 완료, 반려
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- 인덱스 생성
CREATE INDEX idx_vacations_user_id ON vacations(user_id);
CREATE INDEX idx_vacations_date ON vacations(date);
CREATE INDEX idx_vacations_status ON vacations(status);
CREATE INDEX idx_vacations_user_date ON vacations(user_id, date);

-- RLS (Row Level Security) 활성화
ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 휴가를 조회할 수 있음
CREATE POLICY "Users can view their own vacations"
  ON vacations FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 휴가를 생성할 수 있음
CREATE POLICY "Users can create their own vacations"
  ON vacations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 휴가를 수정할 수 있음 (대기 중인 경우만)
CREATE POLICY "Users can update their own pending vacations"
  ON vacations FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 휴가를 삭제할 수 있음 (대기 중인 경우만)
CREATE POLICY "Users can delete their own pending vacations"
  ON vacations FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');
```

## 2. vacation_balances 테이블 (연차 잔액 관리 - 선택사항)

```sql
CREATE TABLE vacation_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_days DECIMAL(5, 1) DEFAULT 0, -- 총 연차 일수
  used_days DECIMAL(5, 1) DEFAULT 0, -- 사용한 연차 일수
  remaining_days DECIMAL(5, 1) DEFAULT 0, -- 남은 연차 일수
  year INTEGER NOT NULL, -- 연도
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year)
);

CREATE INDEX idx_vacation_balances_user_year ON vacation_balances(user_id, year);

ALTER TABLE vacation_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vacation balance"
  ON vacation_balances FOR SELECT
  USING (auth.uid() = user_id);
```

## 3. 업데이트된 시간 자동 설정 함수

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vacations_updated_at
  BEFORE UPDATE ON vacations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vacation_balances_updated_at
  BEFORE UPDATE ON vacation_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## 4. 한국어 상태 매핑

프론트엔드에서 사용하는 한국어 상태:
- "대기 중" → `pending`
- "승인 완료" → `approved`
- "반려" → `rejected`

프론트엔드에서 사용하는 휴가 유형:
- "연차" → `FULL`
- "오전 반차" → `AM`
- "오후 반차" → `PM`
