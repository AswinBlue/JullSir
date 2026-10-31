-- JullSir(줄서) Supabase PostgreSQL Database Schema & Production Functions
-- Execute in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- 1. 대기열(queues) 테이블
CREATE TABLE IF NOT EXISTS queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_token UUID NOT NULL DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    current_serving_number INT NOT NULL DEFAULT 0,
    last_issued_number INT NOT NULL DEFAULT 0,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours')
);

-- 2. 티켓(tickets) 테이블
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    ticket_number INT NOT NULL,
    email VARCHAR(255),
    push_subscription JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING', -- 'WAITING', 'CALLED', 'SKIPPED', 'COMPLETED', 'CANCELLED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    UNIQUE(queue_id, ticket_number)
);

-- 3. 고속 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_tickets_queue_lookup ON tickets(queue_id, status, ticket_number);
CREATE INDEX IF NOT EXISTS idx_queues_admin_token ON queues(admin_token);
CREATE INDEX IF NOT EXISTS idx_queues_expires_at ON queues(expires_at);

-- 4. Realtime 복제(Replication) 설정
ALTER TABLE queues REPLICA IDENTITY FULL;
ALTER TABLE tickets REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'queues'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE queues;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tickets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
    END IF;
END $$;

-- 5. 원자적 순번 발급 함수 (Atomic Ticket Issuance RPC)
-- 동시 발급 경합 방지(Race condition protection) 및 동일 이메일 중복 발급 복원(N-1)
CREATE OR REPLACE FUNCTION issue_ticket_atomic(
    p_queue_id UUID,
    p_email VARCHAR DEFAULT NULL,
    p_subscription JSONB DEFAULT NULL
)
RETURNS TABLE (new_ticket_id UUID, new_ticket_number INT, is_existing BOOLEAN) AS $$
DECLARE
    v_next_number INT;
    v_ticket_id UUID;
    v_is_closed BOOLEAN;
    v_existing_id UUID;
    v_existing_num INT;
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

    -- N-1: 동일 이메일 중복 발급 시 신규 번호 채번 방지 및 기존 발급 티켓 복원
    IF p_email IS NOT NULL AND TRIM(p_email) <> '' THEN
        SELECT id, ticket_number INTO v_existing_id, v_existing_num
        FROM tickets
        WHERE queue_id = p_queue_id 
          AND LOWER(email) = LOWER(TRIM(p_email)) 
          AND status = 'WAITING'
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            RETURN QUERY SELECT v_existing_id, v_existing_num, TRUE;
            RETURN;
        END IF;
    END IF;

    -- 2) 원자적 번호 증가
    UPDATE queues
    SET last_issued_number = last_issued_number + 1,
        updated_at = NOW()
    WHERE id = p_queue_id
    RETURNING last_issued_number INTO v_next_number;

    -- 3) 티켓 생성
    INSERT INTO tickets (queue_id, ticket_number, email, push_subscription, status)
    VALUES (p_queue_id, v_next_number, TRIM(p_email), p_subscription, 'WAITING')
    RETURNING id INTO v_ticket_id;

    RETURN QUERY SELECT v_ticket_id, v_next_number, FALSE;
END;
$$ LANGUAGE plpgsql;

-- 6. 세션 연장 함수 (Touch Session RPC)
CREATE OR REPLACE FUNCTION touch_queue_session(p_admin_token UUID)
RETURNS SETOF queues AS $$
BEGIN
    RETURN QUERY
    UPDATE queues
    SET last_active_at = NOW(),
        expires_at = NOW() + INTERVAL '6 hours',
        updated_at = NOW()
    WHERE admin_token = p_admin_token
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- 7. 6시간 경과 만료 대기열 자동 영구 삭제 함수
CREATE OR REPLACE FUNCTION purge_expired_queues()
RETURNS void AS $$
BEGIN
    DELETE FROM queues
    WHERE expires_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- 8. Row Level Security (RLS) 활성화
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- 익명 사용자(대기자/손님/점주) 정책
-- 대기열 조회/추가/수정/삭제 정책
CREATE POLICY "Allow public select on queues" ON queues FOR SELECT USING (true);
CREATE POLICY "Allow public insert on queues" ON queues FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin update on queues" ON queues FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin delete on queues" ON queues FOR DELETE USING (true);

-- 티켓 조회/추가/수정/삭제 정책
CREATE POLICY "Allow public select on tickets" ON tickets FOR SELECT USING (true);
CREATE POLICY "Allow public insert on tickets" ON tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on tickets" ON tickets FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on tickets" ON tickets FOR DELETE USING (true);
