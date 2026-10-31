# JullSir(줄서) Supabase 프로덕션 연결 가이드

본 문서는 JullSir를 로컬 Mock 저장소에서 **Supabase 클라우드(PostgreSQL + Realtime + Edge Functions)**로 전환하는 방법입니다.

---

## 1. Supabase 프로젝트 생성 (무료 티어)

1. [https://supabase.com](https://supabase.com)에 로그인 후 **New Project** 생성.
2. Database 패스워드 설정 및 리전(Region)을 **Seoul (ap-northeast-2)**로 선택.

---

## 2. 데이터베이스 스키마 및 RPC 함수 배포

1. Supabase 대시보드 좌측 메뉴에서 **SQL Editor**로 이동.
2. `supabase/schema.sql` 파일의 내용을 복사하여 붙여넣고 **Run** 실행.
3. `queues`, `tickets` 테이블 및 `issue_ticket_atomic` 원자적 RPC 함수가 정상 생성되었는지 확인.

---

## 3. Realtime 활성화

1. 좌측 메뉴 **Database** $\rightarrow$ **Replication** 선택.
2. `supabase_realtime` 소스에서 `queues` 및 `tickets` 테이블 토글을 **ON**으로 활성화.

---

## 4. Edge Functions 배포 (알림 발송용)

> [!TIP]
> Node 24 환경의 `npx` 결함 방지 및 Docker 없는 안전한 클라우드 배포를 위해 `corepack pnpm@9 dlx supabase` 또는 `scripts/menu.ps1`을 사용합니다.

```bash
# 1. Supabase CLI 로그인 (브라우저 인증창 오픈)
corepack pnpm@9 dlx supabase login

# 2. 프로젝트 연결
corepack pnpm@9 dlx supabase link --project-ref <your-project-id>

# 3. 환경변수 설정 (Resend API 키 등)
corepack pnpm@9 dlx supabase secrets set RESEND_API_KEY=re_xxxxxxxx

# 4. 함수 배포 (Docker 불필요, 클라우드 API 빌드)
corepack pnpm@9 dlx supabase functions deploy notify-ticket --use-api --no-verify-jwt
```

또는 Windows에서는 원클릭 대화형 메뉴를 실행하여 간편하게 진행할 수 있습니다:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/menu.ps1
```

---

## 5. 프론트엔드 환경변수 연결

`.env.production` 파일 생성:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...
```

Vite 빌드 시 자동으로 환경변수가 번들에 주입되어 Supabase 클라이언트로 동작합니다.
