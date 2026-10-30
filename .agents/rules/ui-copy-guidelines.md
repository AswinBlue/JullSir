# UI Copywriting & User-Facing Text Guidelines

## Core Rule
**Never expose developer-centric requirements, internal infrastructure metrics, or architecture constraints directly to end-users on UI screens.**

### Key Restrictions:
1. **No Cost/Free Slugs on UI**:
   * Do not display "100% 무료", "Zero-Cost", "비용 0원", "Free Tier".
   * Instead, focus on user benefits: "간편한 실시간 대기", "스마트 알림", "누구나 쉽게 시작하는".
2. **No Backend Architecture Jargon**:
   * Do not expose terms like "Cloud Queueing Solution", "WebSocket Connection", "Atomic RPC", "Serverless".
   * Instead, use human outcomes: "실시간 순번 안내", "중복 없는 안전한 접수".
3. **Professional UX Tone**:
   * Model tone after modern Korean fintech/lifestyle services (Toss, CatchTable, Baemin): clear, confident, respectful, and customer-first.
4. **Automated Verification**:
   * Before completing any UI task, run `npm run audit:copy` (or `node .agents/skills/user-facing-copy-audit/scripts/audit_ui_copy.mjs`).
