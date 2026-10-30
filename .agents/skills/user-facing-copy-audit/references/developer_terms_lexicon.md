# Developer Terms vs. Customer-Centric Copy Lexicon

This reference maps technical, developer-centric terms commonly found in SRS/PRD documents to polished, professional customer-facing expressions.

| 카테고리 | ❌ 개발자 관점 표현 (UI 지양) | 사유 | ✅ 사용자 관점 권장 표현 |
| :--- | :--- | :--- | :--- |
| **비용 & 예산** | `100% 무료`, `완전 무료` | 서비스의 전문성과 신뢰도를 떨어뜨림 | `실시간 대기`, `스마트 알림`, `간편한 시작` |
| | `비용 0원`, `Zero-Cost` | 개발/운영진의 인프라 목표일 뿐 사용자 혜택이 아님 | `부담 없이 시작하는`, `스마트 대기열 서비스` |
| | `Free Tier`, `상시 무료 한도` | 클라우드 과금 정책 용어로 손님에게 무의미함 | 문구 생략 또는 `누구나 간편하게` |
| **인프라 & 기술** | `Cloud Queueing Solution` | 공급자적 엔터프라이즈 기술 용어 | `스마트 실시간 대기열 서비스` |
| | `WebSocket`, `Realtime Broadcast` | 개발자 통신 프로토콜 명칭 | `실시간 순번 안내`, `자동 순번 업데이트` |
| | `원자적 동시성 (Atomic)` | 트랜잭션/DB 메커니즘 용어 | `중복 없는 안전한 순번 발급` |
| | `Database`, `Postgres`, `RPC` | 데이터베이스 백엔드 구현 스펙 | `안전한 데이터 보관` |
| | `Server Actions`, `Node.js` | 런타임 프레임워크 명칭 | UI에 절대 비노출 |
| **역할 & 엔티티** | `Host` (사용자 대면 화면) | 백엔드 권한 및 프로토콜 용어 | `매장 점주`, `매장 관리자` |
| | `Guest` (사용자 대면 화면) | 시스템 인가(Auth) 레벨 용어 | `손님`, `대기 손님`, `방문객` |
| **보안 & 식별자** | `UUID Token`, `비밀 토큰` | 암호학적 구현체 명칭 | `관리자 전용 링크`, `보안 관리 주소` |
| | `엔드포인트`, `Endpoint` | API 라우트 명칭 | `접속 링크`, `페이지 주소` |
| | `JSON Payload`, `VAPID` | 직렬화/암호화 기술 용어 | `알림 데이터`, `웹 푸시` |
| **설치 & 환경** | `앱 설치 없이 웹 브라우저에서 바로` | 개발자의 웹 아키텍처 우위 강조 | `스마트폰으로 간편하게 바로 시작` |
