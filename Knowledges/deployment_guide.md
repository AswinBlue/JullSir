# JullSir(줄서) 프로덕션 연동 및 배포 가이드 (Deployment Guide)

| 문서 버전 | 작성 일자 | 대상 시스템 | 운영 예산 | 개인정보 수집 | 커스텀 도메인 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| v2.0.0 | 2026-11-01 | JullSir 실시간 큐잉 웹 서비스 | **월 $0 (Zero-Cost / Free Tier)** | **0건 (Zero-PII)** | **불필요 (Zero-Domain)** |

---

## 1. 개요 및 아키텍처

JullSir는 외부 유료 인프라나 도메인 구매 비용 없이 완전 무료(Always Free Tier)로 운영되는 실시간 모바일 대기열 시스템입니다.  
초기 버전의 이메일 발송 의존성(Resend, Mailjet, 커스텀 도메인 구매, SPF/DKIM/DMARC 설정, Edge Functions)을 전면 제거하고, 웹 표준 네이티브 알림 기술(Supabase Realtime, Screen Wake Lock API, Web Audio, Web Vibration, Web Push)을 결합하여 운영 복잡도를 0으로 최소화했습니다.

### 1.1 시스템 구성도

```
[고객 / 점주 브라우저 (React + Vite PWA)]
   │
   ├─► 1. Supabase Database (PostgreSQL)
   │     - 원자적 순번 발급 RPC (issue_ticket_atomic: 동시 경합 차단)
   │     - 6시간 세션 자동 관리 및 데이터 완전 파기
   │
   ├─► 2. Supabase Realtime (WebSocket: postgres_changes)
   │     - 점주의 호출(CALL) / 스킵(SKIP) / 입장완료(COMPLETE) 이벤트 실시간 브로드캐스트
   │
   └─► 3. 네이티브 진동벨 & 알림 엔진 (클라이언트 내장)
         - Android: Web Push 시스템 알림 및 진동
         - iOS / 공통: Screen Wake Lock (화면 꺼짐 방지) + Web Audio/Vibration 진동벨 시나리오
         - 백그라운드 전환 유도: 홈 화면 추가(PWA) 인터랙티브 가이드
```

* **프론트엔드 호스팅**: GitHub Pages (`https://aswinblue.github.io/Jullsir`)
* **데이터베이스 & 실시간 통신**: Supabase (PostgreSQL + Realtime WebSocket)
* **알림 아키텍처**: 브라우저 네이티브 Realtime 진동벨 엔진 (이메일 서버 및 도메인 불필요)

---

## 2. Supabase 연동 설정 (데이터베이스 & 실시간)

### 2.1 계정 가입 및 프로젝트 생성
1. [Supabase 공식 홈페이지](https://supabase.com)에 접속하여 무료 계정으로 가입 또는 로그인합니다.
2. 대시보드 우측 상단 **[New Project]** 버튼을 클릭합니다.
3. 프로젝트 정보를 입력합니다:
   * **Name**: `JullSir` (또는 희망하는 프로젝트명)
   * **Database Password**: 안전한 비밀번호 입력 (보관 필요)
   * **Region**: `Seoul (ap-northeast-2)` (한국 접속 지연 시간 최소화)
   * **Pricing Plan**: `Free` ($0/month)
4. **[Create new project]**를 클릭하고 프로비저닝이 완료될 때까지 약 1~2분 대기합니다.

### 2.2 API 키 및 URL 확인 및 환경변수 설정
1. 프로젝트 좌측 메뉴에서 **Project Settings** (톱니바퀴 아이콘) -> **API**로 이동합니다.
2. 다음 두 가지 항목을 복사합니다:
   * **Project URL**: `https://<your-project-id>.supabase.co`
   * **Project API keys**의 `anon` `public` 키: `eyJhbGciOiJIUzI1NiIsInR5cCI...`

#### 환경변수 등록 위치
* **로컬 개발 및 테스트 환경**:
  프로젝트 루트 폴더에 `.env.local` 파일을 생성하고 아래와 같이 저장합니다:
  ```env
  VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...
  ```
* **GitHub Pages 배포 환경 (GitHub Secrets)**:
  1. GitHub 저장소 (`https://github.com/AswinBlue/JullSir`) 접속
  2. **Settings** -> **Secrets and variables** -> **Actions** 이동
  3. **[New repository secret]**을 통해 2개 시크릿 등록:
     * `VITE_SUPABASE_URL`: Project URL
     * `VITE_SUPABASE_ANON_KEY`: anon public 키

---

### 2.3 데이터베이스 스키마 및 원자적 RPC 배포
1. Supabase 좌측 메뉴에서 **SQL Editor**로 이동합니다.
2. **[New query]**를 클릭합니다.
3. 프로젝트 루트의 `supabase/schema.sql` 파일 전체 내용을 복사하여 쿼리 입력창에 붙여넣습니다.
4. 우측 하단의 **[Run]** (또는 Ctrl+Enter)을 실행합니다.
5. 실행이 완료되면 다음 데이터베이스 객체들이 자동 생성됩니다:
   * `queues` 테이블 (대기열 메타데이터 및 6시간 세션 만료 관리)
   * `tickets` 테이블 (발급 순번표, 개인정보 수집 필드 없음)
   * `issue_ticket_atomic` 함수 (순번 동시 발급 시 번호 중복/충돌 방지 원자적 트랜잭션 RPC)
   * `touch_queue_session` 함수 (세션 6시간 갱신)
   * `purge_expired_queues` 함수 (만료된 세션 및 순번 데이터 영구 파기)
   * `supabase_realtime` 복제 테이블 자동 등록 (Realtime 즉시 활성화)

---

## 3. 무비용·무도메인 네이티브 알림 아키텍처

JullSir는 별도의 도메인 구매 비용이나 메일 발송 서비스 구독료 없이 완전 무료로 동작합니다.

### 3.1 별도 도메인 및 메일 서비스가 필요 없는 이유
1. **개인정보 제로(Zero-PII)**: 이메일이나 전화번호를 일절 수집하지 않으므로 외부 통신사나 SMTP 메일 발송망을 경유할 필요가 없습니다.
2. **DNS 인증 불필요**: 커스텀 도메인(SPF, DKIM, DMARC) 설정이나 복잡한 네임서버 레코드 등록이 전혀 요구되지 않습니다.
3. **Edge Functions 비용 제로**: 클라이언트가 Supabase Realtime 채널을 직접 구독하므로 별도의 서버리스 연동 함수 배포가 불필요합니다.

### 3.2 디바이스별 알림 동작 방식
* **Android 환경**:
  - 알림 권한 획득 시 Web Push 알림 자동 적용
  - 화면이 꺼져 있거나 다른 앱 사용 중에도 시스템 상단 푸시 배너 및 진동 발생
* **iOS (아이폰) 환경**:
  - Screen Wake Lock API를 통해 대기표 화면 유지 유도 ("화면 꺼짐 방지 적용 중")
  - 순번 호출 시 브라우저 내 네온 테두리 점멸 및 Web Audio/진동벨 루프 60초간 지속
  - "화면 끄고 싶다면?" 버튼을 통해 Safari 홈 화면 추가(PWA) 인터랙티브 가이드 제공
* **공통 진동벨 시나리오**:
  - 손님이 화면을 켜둔 상태에서 차례가 되면 60초간 알림음과 진동이 울리며 최상단에 `[알림 소리/진동 끄기 (확인)]` 버튼이 표시됩니다.
  - 이미 순번이 지나간 뒤 화면에 접속한 경우에는 깜짝 놀라는 오작동을 방지하기 위해 진동벨이 울리지 않습니다.

---

## 4. 프론트엔드 빌드 및 GitHub Pages 자동 배포

### 4.1 동작 모드 자동 감지
JullSir 프론트엔드는 환경변수 유무에 따라 자동 전환됩니다:
* `VITE_SUPABASE_URL` 설정 시: **Supabase 클라우드 실시간 모드** (실제 운영 환경)
* 미설정 시: **로컬 인메모리 Mock 모드** (네트워크 없는 시연 및 데모용)

### 4.2 로컬 개발 서버 실행
```bash
corepack pnpm@9 run dev
```

### 4.3 GitHub Pages 자동 배포
1. `master` 브랜치에 코드를 푸시하면 `.github/workflows/deploy.yml` 워크플로가 자동 실행됩니다.
2. Vite가 최적화 번들을 빌드하고 GitHub Pages (`https://aswinblue.github.io/Jullsir`)로 자동 배포합니다.

---

## 5. 운영 및 유지보수 가이드

### 5.1 Supabase 7일 슬립 방지 (Keep-Alive 스케줄러)
Supabase 무료 티어 프로젝트는 7일간 호출이 없으면 데이터베이스가 일시 정지(Pause)됩니다.  
JullSir는 이를 원천 방지하기 위해 **GitHub Actions 주간 헬스체크 스케줄러**(`.github/workflows/supabase-keepalive.yml`)를 탑재하고 있습니다:
* **실행 주기**: 매주 월요일 오전 09:00 KST (일요일 00:00 UTC) 자동 실행
* **동작 내용**: Supabase DB 핑 쿼리를 실행하여 7일 비활성 타이머를 리셋하고 응답 지연 시간을 기록
* **수동 실행**: GitHub Actions 탭에서 언제든지 `[Run workflow]`를 클릭하여 즉시 헬스체크 가능

### 5.2 6시간 세션 자동 만료 및 개인정보 보호
* **세션 유효기간**: 세션 생성 시점부터 6시간 동안 유효합니다.
* **세션 갱신**: 관리자 화면에서 남은 시간이 3시간 미만일 때 `[세션 6시간 연장]` 버튼이 노출되며, 클릭 시 현재 시점 기준으로 6시간이 다시 갱신됩니다.
* **데이터 완전 파기**: 6시간이 만료되거나 관리자가 `[오늘 영업 종료 및 대기열 즉시 정리]`를 실행하면 관련 대기표 데이터가 데이터베이스에서 영구 삭제됩니다.
