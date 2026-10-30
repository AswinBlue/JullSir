---
name: user-facing-copy-audit
description: >-
  Audits user interface (UI) and user-facing text to prevent developer-centric specifications,
  internal infrastructure constraints, and architecture/cost terms (e.g. '100% free', 'Zero-cost',
  'Serverless', 'RPC', 'Token') from leaking into the end-user experience.
  Transforms technical developer requirements into customer-centric value propositions.
---

# User-Facing Copy Audit & Sanitization Skill

This skill guides the agent in auditing, sanitizing, and translating developer requirements and system specifications into professional, customer-centric UI copy.

## Core Principle: "Developer Constraint ≠ User Value"

When developers receive technical requirements (e.g., "Zero-Cost architecture", "100% Free Tier", "Atomic RPC locking"), these describe **how the software is built and operated**. They must **never** be copied verbatim into the UI displayed to store owners or waiting customers.

* ❌ **Developer-Centric**: "100% 무료", "Zero-Cost Cloud Queueing", "원자적 동시성", "UUID 관리자 토큰"
* ✅ **Customer-Centric**: "실시간 스마트 대기", "줄 서지 않는 편안함", "순번 중복 없는 안전한 접수", "관리자 전용 링크"

---

## When to Use This Skill

1. Reviewing or creating user-facing views (`src/pages/`, `src/components/`, `index.html`).
2. Translating SRS (Software Requirements Specification) into screen mockups or UI copy.
3. Checking for forbidden technical jargon, infrastructure labels, or cost slogans before release.

---

## Step-by-Step Audit Procedure

### 1. Run Automated Scan
Run the built-in audit script to scan all frontend files for forbidden patterns:
```bash
node .agents/skills/user-facing-copy-audit/scripts/audit_ui_copy.mjs
```

### 2. Check Against the Lexicon
Consult [developer_terms_lexicon.md](./references/developer_terms_lexicon.md) to find the appropriate customer-friendly translation for any flagged terms.

### 3. Replace with Value-Driven Copy
Apply the following 4 transformation filters:
1. **Cost/Budget Filter**: Replace "무료/0원/Zero-Cost" with service convenience ("간편한", "부담 없는", "언제 어디서나").
2. **Architecture Filter**: Replace "Cloud/WebSocket/Serverless" with user outcome ("실시간 동기화", "끊김 없는 안내").
3. **Role Filter**: Replace code entities ("Host", "Guest") with human roles ("매장 점주/관리자", "대기 손님").
4. **Security Filter**: Replace technical crypto terms ("UUID Token", "Endpoint") with natural UI terms ("전용 관리 주소", "바로가기 링크").

### 4. Verification
Re-run the audit script and ensure 0 violations are reported.
