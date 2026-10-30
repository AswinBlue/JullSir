# JullSir (줄서) - 무비용 실시간 대기열 관리 시스템

> **비용 0원(Zero-Cost)으로 누구나 즉시 운영하는 모바일 최적화 실시간 큐잉 웹 서비스**  
> GitHub Pages 호스팅 (`https://aswinblue.github.io/Jullsir`) 지원

---

## 1. 프로젝트 소개

**JullSir(줄서)**는 별도의 유료 인프라나 복잡한 태블릿 키오스크 구매 없이, 스마트폰과 웹 브라우저만으로 대기열을 생성하고 손님을 호출할 수 있는 경량 큐잉 솔루션입니다.

### 핵심 기능
* **Host / 매장 관리자**:
  * **대기열 생성**: 이름과 손님 안내사항을 입력하여 즉시 대기열 생성.
  * **가게 디스플레이 손님용 화면 (`/display/:queueId`)**: 매장 태블릿이나 모니터에 거치해둘 수 있는 전용 뷰 (현재 호출 번호, 대기 인원, 대형 QR 코드, 현장 접수 폼 제공). 뒤로가기 클릭 시 관리자 페이지에 접근할 수 없도록 격리.
  * **관리자 화면 (`/admin/:adminToken`)**: 비밀 토큰 기반 제어 센터. 제목/설명 수정, 다음 번호 호출(Web Push & 사운드/진동 발송), 현재 번호 스킵, 접수 마감(영업 종료) 토글, 매장 부착용 QR 코드 다운로드/인쇄.
* **Guest / 대기 손님**:
  * **모바일 대기표 뽑기 (`/q/:queueId`)**: QR 코드 스캔 또는 링크 접속으로 웹 푸시 수락 또는 이메일 입력 후 즉시 번호표 발급.
  * **실시간 대기 현황 (`/q/:queueId/ticket/:ticketId`)**: 내 순번, 현재 호출 번호, 내 앞 남은 인원 수 실시간 확인. 내 순번 도달 시 화면이 에메랄드 테마로 반전되며 진동과 알림음(차임벨) 및 축하 효과(Confetti) 재생.
  * **자진 대기 취소**: 방문 계획이 변경된 손님이 직접 순번을 취소하여 매장 대기 인원 자동 차감.

---

## 2. 기술 스택 & 무비용 아키텍처

| 영역 | 채택 기술 | 비고 |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide React | 모바일 최적화 반응형 UI (캐치테이블/토스 스타일) |
| **Hosting & CI/CD** | GitHub Pages (`aswinblue.github.io/Jullsir`), GitHub Actions | 완전 무료, Git Push 시 자동 빌드 & 배포 |
| **SPA Routing** | React Router DOM + `404.html` SPA Redirect Restore | GitHub Pages 새로고침 404 방지 |
| **실시간 통신** | LocalStorage + `BroadcastChannel` (실시간 탭 동기화) | 서버 비용 0원, 멀티 창/탭 간 0.05초 동기화 |
| **시청각 피드백** | Web Audio API (합성 차임벨), Vibration API, Notification API | 외부 오디오 의존성 없이 네이티브 구동 |
| **확장 자산** | Supabase PostgreSQL DDL, RPC (`issue_ticket_atomic`), Edge Function | `supabase/` 폴더 내 완비 |

---

## 3. 로컬 실행 방법

```bash
# 1. 의존성 설치
pnpm install
# 또는
corepack pnpm@9 install

# 2. 로컬 개발 서버 실행
pnpm dev

# 3. TypeScript 타입 체크 및 프로덕션 빌드
pnpm typecheck
pnpm build
```

브라우저에서 `http://localhost:3000/Jullsir/`에 접속하여 테스트할 수 있습니다.

---

## 4. GitHub Pages 배포 방법

1. 본 레포지토리를 GitHub의 `Jullsir` 원격 저장소(`main` 브랜치)로 푸시합니다.
2. GitHub 저장소의 **Settings** $\rightarrow$ **Pages** 메뉴로 이동합니다.
3. **Build and deployment** 항목의 **Source**를 `GitHub Actions`로 선택합니다.
4. `.github/workflows/deploy.yml` 워크플로가 자동 실행되어 `https://aswinblue.github.io/Jullsir`에 배포됩니다.
