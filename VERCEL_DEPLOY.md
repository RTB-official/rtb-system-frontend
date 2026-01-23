# Vercel 배포 가이드

## 1. Vercel 계정 생성 및 GitHub 연동

1. [Vercel](https://vercel.com)에 접속하여 계정 생성
2. GitHub 계정으로 로그인
3. "Add New Project" 클릭
4. GitHub 저장소 선택: `RTB-official/RTB-System_Frontend`

## 2. 프로젝트 설정

Vercel이 자동으로 다음을 감지합니다:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

## 3. 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 추가해야 합니다:

### 필수 환경 변수:
- `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
- `VITE_SUPABASE_ANON_KEY`: Supabase Anon Key

### 설정 방법:
1. Vercel 프로젝트 대시보드로 이동
2. **Settings** → **Environment Variables** 클릭
3. 다음 변수들을 추가:
   ```
   VITE_SUPABASE_URL = your_supabase_project_url
   VITE_SUPABASE_ANON_KEY = your_supabase_anon_key
   ```
4. **Production**, **Preview**, **Development** 모두에 적용

## 4. 배포

### 자동 배포 (권장):
- `main` 또는 `dev` 브랜치에 푸시하면 자동으로 배포됩니다
- Pull Request 생성 시 Preview 배포가 자동 생성됩니다

### 수동 배포:
1. Vercel 대시보드에서 **Deployments** 탭 클릭
2. **Redeploy** 버튼 클릭

## 5. 커스텀 도메인 설정 (선택사항)

1. Vercel 대시보드 → **Settings** → **Domains**
2. 원하는 도메인 추가
3. DNS 설정 안내에 따라 도메인 설정

## 참고사항

- 환경 변수는 빌드 시점에 주입되므로, 변경 후 재배포가 필요합니다
- `.env` 파일은 Git에 커밋하지 않습니다 (`.gitignore`에 포함됨)
- Supabase 키는 Vercel 환경 변수로 안전하게 관리됩니다

