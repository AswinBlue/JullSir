# Error Incident & Bug Diagnosis Log: Queue Notification (ERR 대장)

본 문서는 JullSir 대기열 알림 및 관리 시스템에서 발생한 결함과 예외 상황을 체계적으로 추적하고 진단하는 현시점 결함 대장이다.
식별자 부여 규칙: `ERR{YY}{MM}{DD}{NNN}` (3자리 순번)

---

## 1. 결함 진단 및 해결 이력

| 결함 ID | 발생 일시 | 결함 제목 | 실패/연관 TST | 근본 원인 분석 | 해결 방안 | 해결 상태 |
|---|---|---|---|---|---|---|
| **ERR261101001** | 2026-11-01 | 브라우저 Autoplay Policy로 인한 대기열 실시간 호출 시 오디오 유휴 정지 및 무음 현상 | TST26110111 | Chromium/Safari가 유휴 탭에서 AudioContext를 suspended로 자동 전환하며, 비동기 WebSocket 이벤트 발생 시 사용자 제스처 부재로 자동 resume이 거부됨. 사용자가 화면을 탭해야만 제스처가 인정되어 뒤늦게 차임벨이 울림 | 1) 발권 및 대기 화면 진입 시 Web Audio keep-alive 루프 가동하여 AudioContext 'running' 상태 지속 유지.<br>2) 대기 화면에 명시적인 `[🔊 소리 테스트]` 버튼을 제공하여 QR 진입 고객의 선행 권한 획득 유도.<br>3) MasterGainNode를 도입하여 알람 끄기 클릭 시 즉시 게인을 0으로 소거하여 큐잉된 사운드 방출 차단 | **Resolved** |
| **ERR261101002** | 2026-11-01 | 원격 Supabase DB 발권 RPC 호출 시 party_size 매개변수 누락으로 인한 인원수 1명 고정 결함 | TST26110110 | `supabaseQueueRepository.issueTicket`에서 `partySize`를 받아놓고도 `issue_ticket_atomic` RPC 호출 시 넘기지 않았으며, DB 스키마에 `party_size` 컬럼이 없어 `mapDbTicket`에서 기본값 1로 폴백됨 | 1) `issue_ticket_atomic` RPC 호출 시 `p_subscription: { party_size: partySize }` 전달.<br>2) 티켓 행의 `push_subscription` JSONB 필드에 인원수 메타데이터 보존.<br>3) `mapDbTicket`에서 `push_subscription.party_size`를 역직렬화하여 복원 | **Resolved** |
| **ERR261101003** | 2026-11-01 | 고정폭 MobileContainer 내부에서 sm: 미디어 쿼리 발동으로 인한 버튼 텍스트 박스 우측 돌출 결함 | TST26110108 | `MobileContainer`는 448px 고정폭인데 자식 컴포넌트에서 `sm:grid-cols-3`를 사용하여 3번째 컬럼이 110px로 축소됨. `whitespace-nowrap`의 '현재 번호 스킵' 버튼(150px+)이 카드를 뚫고 돌출됨 | 1) 버튼 배치를 `flex-col gap-3` 수직 스택으로 전면 개편하여 풀위드 확보 및 오터치 방지 안전 여백 확보.<br>2) `dev-ui-refinement` 지침에 가변 텍스트 5대 방어 수칙 강화 | **Resolved** |

---

## 2. 결함별 상세 사후 분석 (Post-Mortem)

### 2.1. ERR261101001 상세 분석
- **현상**: 고객이 대기표 화면을 켜두고 대기하던 중 관리자가 호출 버튼을 누르면 화면은 '지금 입장해 주세요!'로 바뀌지만 알람 소리가 울리지 않음. 그러나 고객이 화면의 빈 공간을 터치하거나 알람 끄기 버튼을 누르면 그제서야 '딩동' 소리가 발생함.
- **아키텍처 원인**:
  - Web Audio API의 `AudioContext`는 페이지 로드 후 사용자 클릭 제스처가 없거나, 일정 시간 동안 오디오 노드가 재생되지 않으면 브라우저(특히 Chrome, Safari)에 의해 절전 모드(`suspended`)로 자동 전환됨.
  - 관리자의 호출은 Supabase Realtime WebSocket 메시지로 수신되므로, 이 시점의 자바스크립트 실행 스택에는 사용자 제스처(User Activation Token)가 존재하지 않음. 따라서 `audioCtx.resume()` 호출이 브라우저 보안 정책에 의해 거부(Silent Rejection)되어 오실레이터가 시간 0에 적체됨.
  - 사용자가 화면을 터치하는 순간 비로소 유효한 제스처로 인정되어 적체된 오실레이터가 뒤늦게 재생됨.
- **영구 방어 조치**:
  - 발권 버튼을 누르는 순간(User Gesture) `soundManager.unlockAudio()`를 실행하고 무음 루프 버퍼(`startKeepAlive()`)를 연결하여 `AudioContext`가 유휴 정지 상태로 전락하지 않고 계속 `running`을 유지하도록 방어.
  - 직접 링크 또는 QR 코드로 진입한 사용자를 위해 대기 화면 상단에 `[🔊 소리 테스트]` 버튼을 배치하여 자발적인 터치를 유도하고 사운드 작동 여부를 사전에 인지시킴.
  - 알람 끄기 버튼 클릭 시 사운드가 터져 나오는 현상을 막기 위해 `MasterGainNode.gain.setValueAtTime(0)`으로 즉시 음소거 적용.

### 2.2. ERR261101002 상세 분석
- **현상**: 고객이 발권 화면에서 6명을 선택하고 번호표를 발급받았으나 발권 완료 화면과 관리자 화면 모두 `(1명)`으로 표기됨.
- **아키텍처 원인**:
  - 로컬 목 저장소(`MockQueueRepository`)에는 `partySize`가 저장되었으나, 프로덕션 환경의 `SupabaseQueueRepository`에서 원자적 순번 발급 RPC `issue_ticket_atomic` 호출 시 `p_subscription` 파라미터를 전달하지 않음.
  - PostgreSQL의 `tickets` 테이블에는 별도의 `party_size` 컬럼이 없었으므로 `mapDbTicket`에서 `db.party_size || 1`에 의해 무조건 1로 강제 리셋됨.
- **영구 방어 조치**:
  - DDL 마이그레이션 없이 즉시 운영 가능한 `push_subscription` JSONB 컬럼을 활용하여 `{ party_size: partySize }`를 RPC 및 Update 단계에서 확실히 영속화하고, `mapDbTicket`에서 안전하게 복원하도록 수정.
