# JullSir(줄서) 프로덕션 서버 연동 및 배포 가이드 (Deployment Guide)

| 문서 버전 | 작성 일자 | 대상 시스템 | 운영 예산 |
| :--- | :--- | :--- | :--- |
| v1.0.0 | 2026-10-31 | JullSir 실시간 큐잉 웹 서비스 | **월 $0 (Zero-Cost / Free Tier)** |

---

## 1. 개요 및 아키텍처

JullSir는 클라우드 상시 무료 티어(Always Free Tier)를 활용하여 고정 인프라 비용 없이 운영되는 실시간 모바일 대기열 시스템입니다.

```
[클라이언트 (React + Vite)]
   │
   ├─► 1. Supabase Database (PostgreSQL)
   │     └─ 원자적 순번 발급 RPC (issue_ticket_atomic)
   │     └─ 6시간 세션 자동 관리 및 데이터 파기
   │
   ├─► 2. Supabase Realtime (WebSocket)
   │     └─ 대기열 변경 실시간 브로드캐스트 (postgres_changes)
   │
   └─► 3. Supabase Edge Functions (Deno) + Resend API
         └─ 순번 호출 시 이메일 / 웹 푸시 비동기 발송
```

* **프론트엔드 호스팅**: GitHub Pages (`https://aswinblue.github.io/Jullsir`)
* **데이터베이스 & 실시간 통신**: Supabase (PostgreSQL + Realtime WebSocket)
* **이메일 알림 발송**: Resend API (월 3,000건 무료)

---

## 2. Supabase 설정 (데이터베이스 & 실시간)

### 2.1 계정 가입 및 프로젝트 생성
1. [Supabase 공식 홈페이지](https://supabase.com)에 접속하여 무료 계정으로 가입 또는 로그인합니다.
2. 대시보드 우측 상단 **[New Project]** 버튼을 클릭합니다.
3. 프로젝트 정보를 입력합니다:
   * **Name**: `JullSir` (또는 원하는 이름)
   * **Database Password**: 안전한 비밀번호 입력 (기억해 두세요)
   * **Region**: `Seoul (ap-northeast-2)` (한국 사용자의 지연 시간 최소화)
   * **Pricing Plan**: `Free` ($0/month)
4. **[Create new project]**를 누르고 약 1~2분간 프로비저닝이 완료될 때까지 대기합니다.

### 2.2 API 키 및 URL 확인 및 설정 위치
1. 프로젝트 좌측 메뉴에서 **Project Settings** (⚙️ 아이콘) $\rightarrow$ **API**로 이동합니다.
2. 아래 두 값을 복사합니다:
   * **Project URL**: `https://<your-project-id>.supabase.co`
   * **Project API keys**의 `anon` `public` 키: `eyJhbGciOiJIUzI1NiIsInR5cCI...`

#### 💡 복사한 두 값은 어디에 설정하나요?

* **1) 내 컴퓨터(로컬)에서 테스트/개발할 때**:
  * 프로젝트 루트 폴더(`c:\Github\JullSir\`)에 `.env.local` 파일을 생성하고 아래와 같이 붙여넣습니다:
    ```env
    VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
    VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...
    ```
  * `.env.example` 파일을 복사하여 `.env.local`로 이름을 바꾼 뒤 값만 교체하셔도 됩니다.

* **2) 실제 배포 사이트(GitHub Pages: aswinblue.github.io/Jullsir)에 적용할 때**:
  * GitHub 웹사이트의 저장소 설정(Secrets)에 등록해야 빌드 시 자동으로 반영됩니다.
  1. GitHub 저장소 ([https://github.com/AswinBlue/JullSir](https://github.com/AswinBlue/JullSir)) 접속
  2. 상단 탭 맨 우측 **Settings** 클릭
  3. 좌측 사이드바에서 **Secrets and variables** 클릭 $\rightarrow$ 하위의 **Actions** 클릭
  4. 초록색 **[New repository secret]** 버튼 클릭:
     * **Name**: `VITE_SUPABASE_URL`
     * **Secret**: 복사한 Project URL 붙여넣기 $\rightarrow$ **[Add secret]**
  5. 다시 **[New repository secret]** 버튼 클릭:
     * **Name**: `VITE_SUPABASE_ANON_KEY`
     * **Secret**: 복사한 anon public 키 붙여넣기 $\rightarrow$ **[Add secret]**

---

### 2.3 데이터베이스 스키마 및 원자적 RPC 배포
1. Supabase 좌측 메뉴에서 **SQL Editor**로 이동합니다.
2. **[New query]**를 클릭합니다.
3. 프로젝트 루트의 [`supabase/schema.sql`](file:///c:/Github/JullSir/supabase/schema.sql) 파일 전체 내용을 복사하여 쿼리 에디터에 붙여넣습니다.
4. 우측 하단의 **[Run]** (또는 Ctrl+Enter)을 실행합니다.
5. `Success. No rows returned` 메시지가 나오면 다음 요소가 정상 생성된 것입니다:
   * `queues` 테이블 (대기열 및 6시간 세션 관리)
   * `tickets` 테이블 (발급 순번표, 마스킹 및 완료 시 영구 파기)
   * `issue_ticket_atomic` 함수 (동시 경합 방지 및 중복 이메일 복원 원자적 RPC)
   * `touch_queue_session` 함수 (세션 연장)
   * `purge_expired_queues` 함수 (만료 데이터 정리)
   * `supabase_realtime` 복제 자동 등록 완료 (SQL 내부에서 자동 처리)

---

### 2.4 Realtime 활성화 확인 (선택 사항)

> [!TIP]
> **이미 완료되었습니다!**  
> 위의 2.3단계에서 `supabase/schema.sql`을 실행하셨다면, 스크립트 내부의 `ALTER PUBLICATION supabase_realtime ADD TABLE ...` 명령어를 통해 **Realtime이 데이터베이스 레벨에서 이미 자동으로 활성화**되어 있습니다. 별도의 UI 설정을 찾지 않으셔도 정상 동작합니다.

만약 활성화 여부를 직접 확인하고 싶으시다면 다음 방법 중 편한 방법을 사용하세요:

* **방법 1 (가장 쉬움 - SQL Editor에서 확인)**:
  SQL Editor에서 아래 쿼리를 실행하여 결과에 `queues`와 `tickets`가 나오는지 확인합니다:
  ```sql
  SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
  ```

* **방법 2 (대시보드 UI에서 확인)**:
  * 최신 Supabase UI에서는 좌측 **Database** 메뉴 진입 후 상단 탭 또는 서브메뉴의 **Publications** $\rightarrow$ `supabase_realtime` 항목을 클릭하면 포함된 테이블 목록을 확인할 수 있습니다.
  * 또는 좌측 **Table Editor** $\rightarrow$ `queues` 또는 `tickets` 테이블 선택 $\rightarrow$ 우측 상단 테이블 설정(Edit Table)에서 **Enable Realtime** 체크박스가 켜져 있는지 확인하실 수 있습니다.

---

## 3. Resend 설정 (이메일 알림 연동)

### 3.1 계정 가입 및 API Key 발급
1. [Resend 공식 홈페이지](https://resend.com)에 접속하여 회원가입합니다 (월 3,000건, 일 100건 무료).
2. 좌측 메뉴 **API Keys**로 이동하여 **[Create API Key]**를 클릭합니다.
3. 권한 `Full access`로 키를 생성하고, 발급된 키(`re_xxxxxxxxxxxxxxxxx`)를 복사해 둡니다.

> [!NOTE]
> 커스텀 도메인이 없는 경우, Resend가 기본 제공하는 테스트 발신자(`onboarding@resend.dev`)를 통해 본인 계정 이메일로 테스트 발송이 가능합니다. 실제 운영 시에는 **Domains** 메뉴에서 보유한 도메인의 DNS TXT/MX 레코드를 등록하여 원하는 발신자 주소(예: `no-reply@yourdomain.com`)를 사용할 수 있습니다.

---

## 4. Supabase Edge Functions 배포 (알림 발송용)

### 4.1 Supabase CLI 설치 및 로그인
로컬 터미널(PowerShell 또는 Bash)에서 실행합니다:

```bash
# Supabase CLI 로그인 (브라우저 인증창 오픈)
npx supabase login

# 내 프로젝트와 로컬 연결
npx supabase link --project-ref <your-project-id>
```

### 4.2 Resend API Key 시크릿 등록
Edge Function에서 이메일을 발송할 수 있도록 환경변수를 등록합니다:

```bash
npx supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
```

### 4.3 함수 배포
```bash
npx supabase functions deploy notify-ticket --no-verify-jwt
```
배포가 완료되면 Supabase 대시보드의 **Edge Functions** 메뉴에서 `notify-ticket` 함수가 활성화된 것을 확인할 수 있습니다.

---

## 5. 프론트엔드 환경변수 연결 및 빌드

JullSir는 환경변수의 존재 여부를 스스로 감지하여 동작 모드를 자동 전환합니다:
* `VITE_SUPABASE_URL` 및 `VITE_SUPABASE_ANON_KEY`가 존재하면 $\rightarrow$ **실제 Supabase 클라우드 실시간 모드**로 동작
* 미설정 시 $\rightarrow$ **로컬 격리 Mock 모드**로 동작 (오프라인 테스트 및 데모용)

### 5.1 로컬 개발 환경 연결
프로젝트 루트에 `.env.local` 파일을 생성합니다:

```env
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

로컬 서버를 시작합니다:
```bash
corepack pnpm@9 run dev
```
브라우저 개발자 도구(F12) 콘솔에 `[JullSir] Connecting to live Supabase cloud backend.` 로그가 출력되면 실제 서버와 정상 연동된 것입니다.

---

## 6. GitHub Pages 자동 배포 (GitHub Actions)

JullSir 저장소의 `master` 브랜치에 코드를 푸시하면 GitHub Actions를 통해 정적 사이트가 자동으로 빌드되어 배포됩니다.

### 6.1 GitHub Repository Secrets 등록
1. GitHub 저장소 ([https://github.com/AswinBlue/JullSir](https://github.com/AswinBlue/JullSir))로 이동합니다.
2. **Settings** $\rightarrow$ 좌측 하단 **Secrets and variables** $\rightarrow$ **Actions**를 선택합니다.
3. **[New repository secret]**을 클릭하여 아래 2개 시크릿을 등록합니다:
   * Name: `VITE_SUPABASE_URL` / Secret: `https://<your-project-id>.supabase.co`
   * Name: `VITE_SUPABASE_ANON_KEY` / Secret: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 6.2 배포 확인
1. 코드가 푸시되면 **Actions** 탭에서 `Deploy to GitHub Pages` 워크플로가 자동 실행됩니다.
2. 완료 후 배포 URL ([https://aswinblue.github.io/Jullsir](https://aswinblue.github.io/Jullsir))에 접속하여 프로덕션 동작을 확인합니다.

---

## 7. 운영 및 유지보수 가이드 (Zero-Cost 팁)

### 7.1 Supabase 슬립 방지 (Inactivity Pause)
Supabase Free Tier 프로젝트는 **7일간 API 호출이 없을 경우** 자동 일시 정지(Pause) 상태가 됩니다.
* **해결책**: 매장 운영 중에는 정기적으로 사용되므로 유지되지만, 장기 미사용 시 슬립을 방지하려면 GitHub Actions 스케줄러(Cron)로 주 1회 헬스체크 쿼리를 보내거나, 대시보드에서 `Restore`를 원클릭으로 진행할 수 있습니다.

### 7.2 데이터 수명 주기 및 개인정보 보호 (자동 반영됨)
* **6시간 세션 자동 만료**: 관리자 페이지 미접속 6시간 경과 시 대기열과 저장된 고객 정보가 영구 삭제됩니다.
* **입장 완료/취소 즉시 영구 삭제**: 손님이 입장 완료(`COMPLETED`)되거나 대기를 취소(`CANCELLED`)한 즉시 이메일 정보는 DB에서 영구 파기(`NULL`)됩니다.
* **영업 종료 즉시 정리**: 관리자 대시보드 하단의 `[오늘 영업 종료 및 대기열 즉시 정리]`를 누르면 즉시 모든 데이터가 초기화됩니다.
