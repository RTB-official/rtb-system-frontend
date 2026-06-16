# Supabase RLS 정책 복구 (보고서 · 지출)

## 구성원 지출 관리가 비어 있을 때

`personal_expenses`, `personal_mileage` 테이블도 RLS만 켜지고 정책이 없으면 목록이 비습니다.

SQL Editor에서 실행:

- `supabase/migrations/20260602130000_restore_personal_expense_rls_policies.sql`

복구 후 **로그아웃 → 재로그인** 후 `/expense/member` 새로고침.

---

# 출장 보고서 RLS 정책 복구

Table Editor에서 `work_logs` 등 RLS를 수정한 뒤 **보고서 목록이 비거나** 조회 오류가 나면 아래를 적용하세요.

## 증상

- 보고서 목록이 비어 있음 (`조회된 보고서가 없습니다`)
- 브라우저 콘솔: `출장 보고서 조회 실패`, `permission denied`, `42501`
- `profiles` 조회 실패로 역할(staff/admin) 판별 불가

## 복구 방법 (권장)

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 → **SQL Editor**
2. 저장소 파일 전체를 붙여넣어 실행:
   - `supabase/migrations/20260602120000_restore_work_log_rls_policies.sql`
3. **Run** 실행 후 오류 없는지 확인
4. 앱에서 로그아웃 후 다시 로그인 (JWT 갱신)
5. `/report` 보고서 목록 새로고침

CLI 사용 시:

```bash
supabase db push
```

## 복구 후 정책 요약

| 대상 | SELECT | INSERT/UPDATE/DELETE |
|------|--------|----------------------|
| `work_logs` | admin 전체, 작성자 본인 글, **제출 완료(`is_draft=false`)는 로그인 사용자 전원** | 작성자 또는 admin |
| `work_log_*` 자식 테이블 | 부모 보고서 읽기 권한과 동일 | 부모 보고서 수정 권한과 동일 |
| `profiles` | 로그인 사용자 전원 (`using (true)`, 재귀 없음) | 기존 정책 유지 (이 마이그레이션은 SELECT만 추가) |

staff의 “참여 보고서만 보기”는 **앱(ReportListPage)** 에서 필터합니다. DB에서는 제출된 보고서를 읽을 수 있어야 합니다.

## Table Editor에서 다시 건드리지 말 것

- `work_logs`, `work_log_entries`, `work_log_entries_with_hours` RLS를 임의로 **비활성화**하거나 `USING (false)` 같은 정책 추가
- `profiles` SELECT 정책에서 `profiles` 테이블을 다시 조회하는 조건 (무한 재귀) — `docs/RLS_POLICY_FIX.md` 참고

정책 변경이 필요하면 **SQL 마이그레이션 파일**로만 수정하고, 이 저장소에 커밋하세요.

## 적용 확인 쿼리 (SQL Editor)

로그인 세션으로 테스트하거나, Dashboard에서 `authenticated` 역할로 Policy Simulator를 사용하세요.

```sql
-- 정책 개수 확인 (work_logs에 select 1개 이상)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename like 'work_log%'
order by tablename, policyname;
```
