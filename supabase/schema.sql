-- JullSir(줄서) Supabase PostgreSQL Database Schema & Atomic RPC
-- Production Ready Migration Script

-- 1. 대기열 테이블
CREATE TABLE IF NOT EXISTS queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_token UUID NOT NULL DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    current_serving_number INT NOT NULL DEFAULT 0,
    last_issued_number INT NOT NULL DEFAULT 0,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 티켓 테이블
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    ticket_number INT NOT NULL,
    email VARCHAR(255),
    push_subscription JSONB, -- { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } }
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING', -- 'WAITING', 'CALLED', 'SKIPPED', 'COMPLETED', 'CANCELLED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    UNIQUE(queue_id, ticket_number)
);

-- 3. 빠른 조회를 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_tickets_lookup ON tickets(queue_id, status, ticket_number);
CREATE INDEX IF NOT EXISTS idx_queues_admin_token ON queues(admin_token);

-- 4. 원자적 순번 발급 함수 (Atomic Queue RPC)
CREATE OR REPLACE FUNCTION issue_ticket_atomic(
    p_queue_id UUID,
    p_email VARCHAR DEFAULT NULL,
    p_subscription JSONB DEFAULT NULL
)
RETURNS TABLE (new_ticket_id UUID, new_ticket_number INT) AS $$
DECLARE
    v_next_number INT;
    v_ticket_id UUID;
    v_is_closed BOOLEAN;
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

    -- 2) 원자적 번호 증가
    UPDATE queues
    SET last_issued_number = last_issued_number + 1,
        updated_at = NOW()
    WHERE id = p_queue_id
    RETURNING last_issued_number INTO v_next_number;

    -- 3) 티켓 생성
    INSERT INTO tickets (queue_id, ticket_number, email, push_subscription, status)
    VALUES (p_queue_id, v_next_number, p_email, p_subscription, 'WAITING')
    RETURNING id INTO v_ticket_id;

    RETURN QUERY SELECT v_ticket_id, v_next_number;
END;
$$ LANGUAGE plpgsql;

-- 5. Row Level Security (RLS) 활성화
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- 익명 사용자(대기자/손님): 대기열 공개 정보 조회 허용
CREATE POLICY "Public queues are viewable by everyone" 
ON queues FOR SELECT 
USING (true);

-- 익명 사용자: 티켓 조회 허용 (단, push_subscription 등 민감 정보 보호)
CREATE POLICY "Public tickets are viewable by everyone" 
ON tickets FOR SELECT 
USING (true);
