# profiles 테이블 RLS 정책 수정 가이드

## 문제
`profiles` 테이블에 접근할 때 "infinite recursion detected in policy for relation 'profiles'" 에러가 발생합니다.

## 해결 방법

Supabase 대시보드에서 다음 단계를 따라주세요:

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard 접속
   - 프로젝트 선택

2. **profiles 테이블 RLS 정책 확인**
   - 왼쪽 메뉴에서 "Table Editor" 또는 "Database" → "Tables" 선택
   - `profiles` 테이블 클릭
   - "RLS policies" 탭 클릭

3. **문제가 있는 정책 확인**
   - 현재 10개의 RLS 정책이 있습니다
   - 정책 중에서 자기 자신(`profiles`)을 참조하는 정책이 있는지 확인
   - 예: `profiles` 테이블을 조회하는 정책이 `profiles` 테이블을 다시 참조하는 경우

4. **정책 수정**
   - 무한 재귀를 일으키는 정책을 찾아서 수정하거나 삭제
   - **중요**: `profiles` 테이블을 참조하는 정책이 `profiles` 테이블을 다시 조회하지 않도록 수정
   - 또는 다음 정책을 추가 (기존 정책과 충돌하지 않도록 확인):
     ```sql
     -- 모든 인증된 사용자가 모든 프로필을 조회할 수 있도록
     CREATE POLICY "Authenticated users can view all profiles"
     ON profiles FOR SELECT
     TO authenticated
     USING (true);
     ```
   - 또는 더 제한적인 정책:
     ```sql
     -- 자신의 프로필 또는 모든 프로필 조회 허용
     CREATE POLICY "Users can view profiles"
     ON profiles FOR SELECT
     USING (auth.uid() = id OR true);
     ```

5. **또는 RLS 비활성화 (개발 환경에서만)**
   - `profiles` 테이블의 RLS를 일시적으로 비활성화하여 테스트
   - 프로덕션에서는 권장하지 않음

## 임시 해결책
현재 프론트엔드 코드는 `profiles` 테이블 접근을 건너뛰고 기본값(`User {userId}`)을 사용합니다.
RLS 정책을 수정한 후에는 `getAllUsers` 함수를 다시 수정하여 `profiles` 테이블을 사용하도록 할 수 있습니다.
