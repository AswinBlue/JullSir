# JullSir Supabase 보안 패치 및 스키마 업데이트 가이드 (v2.1.0)

본 문서는 **JullSir**의 프로덕션 배포를 위해 Supabase 데이터베이스에 적용해야 하는 보안 강화 패치 및 최신 스키마 실행 절차를 안내합니다.

---

## 1. 개요 및 변경 목적

1. **`admin_token` 유출 원천 차단 (보안 강화)**:
   - 일반 손님이나 외부자가 Supabase REST API를 통해 대기열 목록을 조회할 때 점주의 관리 비밀키(`admin_token`)가 노출되지 않도록 `public_queues` 뷰를 신설하고, 관리자 전용 보안 함수(`get_admin_queue`)를 등록합니다.
2. **`party_size` 정식 컬럼 영구 저장**:
   - 방문 동행 인원 수(1~99명)가 JSON 임시 저장이 아닌 `tickets` 테이블의 정규 컬럼으로 저장되도록 스키마를 고도화합니다.
3. **완전한 무수집(Zero-PII) 원자적 발권**:
   - `issue_ticket_atomic` RPC에서 불필요한 더미 이메일 생성을 제거하고 순수 익명 원자적 순번 발권을 지원합니다.

---

## 2. Supabase SQL Editor 실행 절차 (1분 소요)

1. [Supabase 대시보드](https://supabase.com/dashboard)에 로그인하여 생성하신 `JullSir` 프로젝트를 선택합니다.
2. 좌측 네비게이션 바에서 **SQL Editor** (터미널 아이콘 `>_`) 메뉴를 클릭합니다.
3. 상단의 **[+ New Query]** 버튼을 클릭하여 새 쿼리 탭을 엽니다.
4. 아래의 **통합 패치 SQL 스크립트** 전체를 복사하여 쿼리 입력창에 붙여넣습니다.
5. 우측 하단의 **[Run]** (또는 단축키 `Ctrl + Enter` / Mac: `Cmd + Enter`)을 누릅니다.
6. 하단 결과창에 `Success. No rows returned`가 표시되면 패치가 완료된 것입니다.

---

## 3. 실행할 SQL 패치 스크립트 (Copy & Paste)

```sql
-- ====================================================================
-- JullSir (줄서) v2.1.0 프로덕션 보안 패치 & 스키마 업데이트
-- ====================================================================

-- 1. tickets 테이블 party_size 정식 컬럼 추가 (기존 테이블 마이그레이션)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tickets' AND column_name = 'party_size'
    ) THEN
        ALTER TABLE tickets ADD COLUMN party_size INT NOT NULL DEFAULT 2;
    END IF;
END $$;

-- 2. 관리자 토큰(admin_token) 유출 방지 공개 뷰(public_queues) 생성
CREATE OR REPLACE VIEW public_queues AS
SELECT 
    id,
    name,
    description,
    current_serving_number,
    last_issued_number,
    is_closed,
    created_at,
    updated_at,
    last_active_at,
    expires_at
FROM queues;

-- 3. 원자적 순번 발급 RPC 함수 업데이트 (party_size 정식 매핑 & Zero-PII)
CREATE OR REPLACE FUNCTION issue_ticket_atomic(
    p_queue_id UUID,
    p_party_size INT DEFAULT 2,
    p_subscription JSONB DEFAULT NULL,
    p_email VARCHAR DEFAULT NULL -- 하위 호환용 파라미터
)
RETURNS TABLE (new_ticket_id UUID, new_ticket_number INT, is_existing BOOLEAN) AS $$
DECLARE
    v_next_number INT;
    v_ticket_id UUID;
    v_is_closed BOOLEAN;
    v_size INT;
BEGIN
    -- 1) 대기열 상태 확인 및 행 잠금(Row-level Lock)
    SELECT is_closed INTO v_is_closed
    FROM queues
    WHERE id = p_queue_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue not found with ID: %', p_queue_id;
    END IF;

    IF v_is_closed THEN
        RAISE EXCEPTION 'This queue is currently closed for new entries.';
    END IF;

    -- 인원수 유효성 검증 (1~99명)
    v_size := GREATEST(1, LEAST(COALESCE(p_party_size, 2), 99));

    -- 2) 원자적 번호 증가
    UPDATE queues
    SET last_issued_number = last_issued_number + 1,
        updated_at = NOW()
    WHERE id = p_queue_id
    RETURNING last_issued_number INTO v_next_number;

    -- 3) 티켓 생성 (Zero-PII: 이메일 미수집, party_size 컬럼 정식 기록)
    INSERT INTO tickets (queue_id, ticket_number, party_size, push_subscription, status)
    VALUES (p_queue_id, v_next_number, v_size, p_subscription, 'WAITING')
    RETURNING id INTO v_ticket_id;

    RETURN QUERY SELECT v_ticket_id, v_next_number, FALSE;
END;
$$ LANGUAGE plpgsql;

-- 4. 관리자 대기열 조회 보안 함수 (RPC: admin_token 인증 후 대기열 반환)
CREATE OR REPLACE FUNCTION get_admin_queue(p_admin_token UUID)
RETURNS SETOF queues AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM queues
    WHERE admin_token = p_admin_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 인덱스 최적화
CREATE INDEX IF NOT EXISTS idx_tickets_queue_lookup ON tickets(queue_id, status, ticket_number);
CREATE INDEX IF NOT EXISTS idx_queues_admin_token ON queues(admin_token);
CREATE INDEX IF NOT EXISTS idx_queues_expires_at ON queues(expires_at);

-- 완료 메시지
COMMENT ON VIEW public_queues IS 'JullSir v2.1.0 Secured Public View';
```
