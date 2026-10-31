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
3. **권한(Permission) 설정**: **`Sending access`**를 선택하고 키를 생성합니다.
   * **Full access가 필요한가요?**: 아닙니다! `Sending access` 권한만 있으면 대기열 알림 이메일 발송(`POST /emails`)이 100% 완벽하게 동작합니다.
   * **보안상 권장 이유 (최소 권한 원칙)**: `Full access`는 도메인 삭제, 결제 설정 변경 등 계정 전체를 제어하는 슈퍼 관리자 권한이므로, 외부 연동 키에는 발송 권한만 부여된 `Sending access`를 사용하는 것이 안전합니다.
4. 발급된 키(`re_xxxxxxxxxxxxxxxxx`)를 복사해 둡니다.

---

### 3.2 커스텀 도메인(Custom Domain) 완벽 가이드

#### 💡 커스텀 도메인이 홈페이지를 뜻하는 것인가요?
**아닙니다.** 도메인(Domain)은 `naver.com`, `jullsir.com`과 같은 **인터넷상의 고유 식별 주소**입니다.  
도메인은 웹사이트 접속 주소(`https://jullsir.com`)로도 사용되지만, 이메일 주소의 골뱅이 뒤 식별자(`notify@jullsir.com`)로도 사용됩니다. 별도의 홈페이지나 웹사이트를 만들지 않더라도, 도메인 소유권만 있으면 이메일 발신 전용으로 등록하여 사용할 수 있습니다.

#### 💡 이메일 발송에 커스텀 도메인이 필요한 이유
1. **수신자 제한 해제 (무료 테스트 발신자의 한계)**:  
   Resend가 기본 제공하는 테스트 발신자(`onboarding@resend.dev`)는 스팸/피싱 악용을 막기 위해 **Resend 계정에 가입한 본인 이메일 주소로만** 발송할 수 있는 샌드박스 상태입니다. 매장을 방문한 실제 고객(손님)에게 입장 안내 메일을 발송하려면 커스텀 도메인 등록이 필수입니다.
2. **스팸 차단 및 반송 방지 (SPF / DKIM / DMARC)**:  
   Google(Gmail), Naver, Daum 등 주요 메일 서비스는 발신 도메인의 DNS 암호화 서명(DKIM) 및 발신 서버 인증(SPF)이 없는 이메일을 스팸함으로 격리하거나 수신 거부(Reject)합니다. 내 도메인의 DNS를 연결해야 고객의 받은편지함(Inbox)에 100% 안전하게 도달합니다.
3. **브랜드 신뢰도 확보**:  
   발신자가 모르는 `resend.dev` 대신 매장/서비스 브랜드 주소(예: `no-reply@jullsir.com`)로 전송되어 고객이 피싱으로 오인하지 않습니다.

#### 💡 커스텀 도메인 설정 권장 방식 (Best Practice: 서브도메인 분리)
* **메인 도메인 대신 전용 서브도메인 등록을 강력 권장**:  
  메인 도메인(`yourdomain.com`)을 직접 등록하기보다는 **`mail.yourdomain.com`** 또는 **`notify.yourdomain.com`** 같은 알림 전용 서브도메인을 Resend에 등록하는 것이 전 세계 이메일 인프라의 표준입니다.
  * **장점**: 기존에 사용 중인 회사 업무용 메일(Google Workspace, 네이버 웍스 등)과의 MX 레코드 충돌을 원천 방지하고, 대기열 알림 발송용 메일 평판(Reputation)을 독립적으로 깨끗하게 유지할 수 있습니다.
* **도메인 준비**: Cloudflare Registrar(마진 없는 원가 판매, 연 1~1.5만원 수준 추천), Namecheap, 가비아 등에서 원하는 도메인을 구매합니다.

---

### 3.3 도메인 네임서버(DNS 관리 시스템) 안내 및 등록 가이드

#### 💡 "도메인 네임서버(DNS 관리 페이지)"는 어디에 있나요?
도메인이 사람을 위한 고유 이름이라면, **DNS(Domain Name System)**는 이 도메인이 어느 서버(IP)를 가리키는지, 어떤 메일 서버(MX)와 암호 서명(TXT)을 가졌는지를 적어두는 **"인터넷의 전화번호부"**입니다.  
별도의 새로운 DNS 서비스에 별도로 가입할 필요 없이, **"도메인을 구매한 등록 대행업체(Registrar)의 관리 콘솔"**에 로그인하면 무료로 제공됩니다.

#### 📌 주요 도메인 구매처별 DNS 관리 페이지 진입 방법
* **Cloudflare (가장 강력 추천: 마진 0원 원가 판매, 10초 내 초고속 DNS 반영)**:
  * 대시보드 로그인 $\rightarrow$ 구매한 도메인 클릭 $\rightarrow$ 좌측 메뉴 **[DNS]** $\rightarrow$ **[레코드]** $\rightarrow$ `[레코드 추가]` 클릭.
* **가비아 (Gabia)**:
  * 로그인 $\rightarrow$ 상단 **My가비아** $\rightarrow$ 서비스 관리의 **[도메인]** $\rightarrow$ 대상 도메인의 **[관리]** $\rightarrow$ **[DNS 관리 툴]** $\rightarrow$ `설정` 클릭.
* **후이즈 (Whois)**:
  * 로그인 $\rightarrow$ **도메인 관리** $\rightarrow$ **[네임서버/DNS 설정]** $\rightarrow$ `고급 DNS 관리` 클릭.
* **Namecheap**:
  * 로그인 $\rightarrow$ **Domain List** $\rightarrow$ 대상 도메인 우측 **[Manage]** $\rightarrow$ 상단 **[Advanced DNS]** 탭 $\rightarrow$ `[Add New Record]` 클릭.

#### 📌 Resend 대시보드와 DNS 설정 필드 1:1 매핑
Resend 대시보드의 **Domains** $\rightarrow$ **[Add Domain]**에 서브도메인(예: `notify.yourdomain.com`)을 입력하면 표 형태로 3가지 레코드가 발급됩니다. 이 항목들을 위 DNS 관리 페이지에서 각각 **[레코드 추가]**를 눌러 그대로 입력합니다:

| Resend 화면 표시명 | 도메인 DNS 관리 화면 입력 필드 | 입력값 예시 | 설명 |
|---|---|---|---|
| **Type** | 레코드 유형 | `TXT` 또는 `MX` | 레코드 종류 선택 |
| **Name** | 이름 / 호스트 / 호스트 이름 | `resend._domainkey` 또는 `bounces` | Resend가 지정한 서브도메인 이름 |
| **Value** | 값 / 콘텐츠 / 대상 서버 | `p=MIGfMA0GCS...` 또는 `feedback-smtp.resend.com` | Resend가 발급한 고유 암호 서명키/서버 |
| **Priority** | 우선순위 | `10` | MX 레코드에만 적용 (TXT는 빈칸) |
| **TTL** | TTL (생존 시간) | `Auto` 또는 기본값(`3600`) | 기본값 유지 |

> [!TIP]
> **💡 지금 당장 도메인이 없거나 구매 전이라면?**  
> **개발 및 프로토타입 단계에서는 도메인 구매 및 DNS 등록을 건너뛰어도 전혀 문제없습니다!**  
> Resend가 기본 제공하는 테스트 발신자(`onboarding@resend.dev`)를 사용하면, Resend에 가입하신 본인 이메일 계정으로 알림 메일이 정상 발송되는지 즉시 무료로 테스트할 수 있습니다. 실제 상용 매장 오픈 시점에 도메인을 연결하시면 됩니다.

#### 💡 제약조건 및 무료 플랜 정책
* **무료 플랜 쿼터**: Resend 무료 플랜은 **일 100건, 월 3,000건**까지 전액 무료입니다. (초과 시 유료 플랜 전환 또는 건당 과금).
* **DNS 전파 시간**: DNS 레코드 등록 후 전 세계에 반영되기까지 보통 5분~수 시간이 소요될 수 있습니다. (Cloudflare의 경우 통상 1~2분 이내 즉시 반영).

---

## 4. Supabase Edge Functions 배포 (알림 발송용)

### 4.1 원클릭 Supabase CLI 로그인 및 프로젝트 연결

프로젝트 ID를 수동으로 복사해서 명령어를 칠 필요 없이, `.env` 또는 `.env.local` 파일에 적힌 `VITE_SUPABASE_URL`을 자동으로 읽어 연결해 주는 스크립트를 제공합니다.

**Windows (PowerShell)**:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/supabase-login.ps1
```
*(또는 `powershell -ExecutionPolicy Bypass -File scripts/menu.ps1` 실행 후 `[6]`번 선택)*

**Mac / Linux / Git Bash**:
```bash
./scripts/supabase-login.sh
```

스크립트가 브라우저 로그인 창을 띄우고, `.env`의 Project ID를 자동 추출하여 Supabase 프로젝트 연결까지 한 번에 완료합니다.

---

### 4.2 Resend API Key 시크릿 등록

Edge Function에서 이메일을 발송할 수 있도록 Supabase 클라우드에 환경변수를 등록합니다.

> [!WARNING]
> **Node 24 환경에서 `npx supabase secrets set` 실행 시 발생하는 버그 안내**  
> Node v24 + npm v11 환경에서는 npm 내부 종속성(`minipass-collect`)의 버그로 인해 `Class extends value undefined is not a constructor or null` 에러가 발생합니다.  
> 따라서 `npx`를 사용하지 마시고, 아래의 **전용 스크립트**나 **`corepack pnpm`** 명령어를 사용해야 합니다.

**방법 A: 원클릭 스크립트 실행 (추천)**:
* **Windows (PowerShell)**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/supabase-secrets.ps1
  ```
  *(또는 `scripts/menu.ps1` 실행 후 `[8]`번 선택)*
* **Mac / Linux / Git Bash**:
  ```bash
  ./scripts/supabase-secrets.sh
  ```

**방법 B: 수동 명령어 직접 입력 (Node 24 버그 회피)**:
```bash
corepack pnpm@9 dlx supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
```
*(이미 `pnpm`이 전역 설치된 환경에서는 `pnpm dlx supabase secrets set RESEND_API_KEY=...`로 바로 실행 가능합니다.)*

> [!IMPORTANT]
> **💡 Q. 다른 PC로 개발 환경을 옮기면 Supabase 설정이 초기화되거나 변경되나요?**  
> **아닙니다! 절대 변경되지 않고 클라우드에 영구 유지됩니다.**  
> `schema.sql`로 생성한 테이블, `issue_ticket_atomic` RPC 함수, `secrets set`으로 등록한 API Key, 그리고 배포된 Edge Function은 모두 로컬 컴퓨터가 아니라 **Supabase 클라우드 서버**에 안전하게 보관됩니다.  
> 따라서 다른 PC에서 git clone을 받더라도 `.env.local` 파일만 복사해 두면 기존 데이터베이스와 실시간 백엔드에 즉시 그대로 연결됩니다. Edge Function을 추가로 수정/재배포할 때만 새 PC에서 `scripts/supabase-login.ps1`을 한 번 실행해 CLI 인증을 해주시면 됩니다.

---

### 4.3 함수 배포 (Docker 불필요)

Edge Function을 배포할 때 로컬에 Docker가 설치되어 있지 않거나 Node 24의 `npx` 버그가 있을 경우 에러가 발생할 수 있습니다. 이를 방지하고 클라우드 서버 번들링(`--use-api`) 방식으로 안전하게 배포하는 전용 스크립트를 실행합니다:

**Windows (PowerShell)**:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/supabase-deploy.ps1
```
*(또는 `scripts/menu.ps1` 실행 후 `[7]`번 선택)*

**Mac / Linux / Git Bash**:
```bash
./scripts/supabase-deploy.sh
```

**수동 명령어 (직접 입력 시)**:
```bash
corepack pnpm@9 dlx supabase functions deploy notify-ticket --project-ref <your-project-id> --use-api --no-verify-jwt
```
> `--use-api` 플래그는 로컬 Docker 데몬 없이 Supabase 클라우드 상에서 직접 번들링하여 배포하므로 Docker 설치가 전혀 필요 없습니다.

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

### 7.1 Supabase 7일 슬립 방지 및 독립 헬스체크 아키텍처

Supabase Free Tier 프로젝트는 **7일간 활성 API 호출이 없을 경우** 데이터베이스가 자동 일시 정지(Pause) 상태가 됩니다.

이를 방지하기 위해 JullSir에는 **GitHub Actions 주간 헬스체크 스케줄러**([`.github/workflows/supabase-keepalive.yml`](file:///c:/Github/JullSir/.github/workflows/supabase-keepalive.yml))와 **러너 스크립트**([`scripts/healthcheck.mjs`](file:///c:/Github/JullSir/scripts/healthcheck.mjs))가 탑재되어 있습니다.

#### 1) JullSir 단독 Keep-Alive 동작 방식
* **스케줄**: **매주 월요일 오전 09:00 KST (00:00 UTC)**에 GitHub Actions가 자동으로 실행됩니다.
* **동작**: JullSir 자체의 Supabase DB에 쿼리를 전송하여 DB 활동을 트리거(7일 비활성 카운트다운 리셋)하고, 응답 속도와 상태를 측정합니다.
* **수동 즉시 실행**: GitHub 저장소의 **Actions** 탭 $\rightarrow$ `Supabase Weekly Keep-Alive & Healthcheck` 선택 $\rightarrow$ **[Run workflow]**를 눌러 언제든 즉시 테스트할 수 있습니다.
* **이메일 리포팅 (선택)**: GitHub Secrets에 `REPORT_EMAIL`과 `RESEND_API_KEY`를 등록하면 점검 결과를 매주 이메일로 받아볼 수 있습니다. (미설정 시에도 GitHub Actions 요약 대시보드에 표로 기록됩니다.)

---

#### 2) 💡 아키텍처 제언: 다중 프로젝트 모니터링은 "전용 헬스체크 레포지토리"로 분리

> [!NOTE]
> **프로젝트 간 의존성 완전 분리 (Decoupled Architecture)**  
> JullSir는 '고객 대기열 관리' 서비스입니다. 만약 JullSir가 다른 프로젝트 B, C, D의 모니터링까지 담당하게 되면, **프로젝트 간 불필요한 결합(Coupling)**이 생기고 JullSir 레포지토리의 변경이나 삭제 시 다른 프로젝트의 헬스체크까지 영향을 받게 됩니다.

따라서 여러 프로젝트를 운영하실 때 가장 이상적이고 깔끔한 구조는 다음과 같습니다:

1. **JullSir 저장소**:
   * 오직 **JullSir 자신의 Supabase DB만** 헬스체크하여 슬립을 방지하고 자기 자신에게만 집중합니다.
2. **독립 중앙 헬스체크 저장소 (예: `central-keepalive`) 신설**:
   * 모니터링 전용 레포지토리를 별도로 생성합니다.
   * 전역 에이전트 스킬인 **`release-keepalive-healthcheck`**를 호출하여 해당 레포지토리에 스케줄러와 러너를 단 1분 만에 세팅합니다.
   * 해당 중앙 저장소에서 모든 프로젝트(JullSir, 프로젝트 B, 프로젝트 C 등)의 URL을 등록하고, 매주 월요일 일괄 쿼리를 전송하여 **단 1통의 통합 이메일 리포트**를 수신합니다.

이렇게 분리하면 각 프로젝트는 서로의 존재를 알 필요 없이 완벽하게 독립되며, 중앙 모니터링 레포지토리 한 곳에서 모든 백엔드의 건강 상태를 안전하게 통합 관리할 수 있습니다.

---

### 7.2 데이터 수명 주기 및 개인정보 보호 (자동 반영됨)
* **6시간 세션 자동 만료**: 관리자 페이지 미접속 6시간 경과 시 대기열과 저장된 고객 정보가 영구 삭제됩니다.
* **입장 완료/취소 즉시 영구 삭제**: 손님이 입장 완료(`COMPLETED`)되거나 대기를 취소(`CANCELLED`)한 즉시 이메일 정보는 DB에서 영구 파기(`NULL`)됩니다.
* **영업 종료 즉시 정리**: 관리자 대시보드 하단의 `[오늘 영업 종료 및 대기열 즉시 정리]`를 누르면 즉시 모든 데이터가 초기화됩니다.
