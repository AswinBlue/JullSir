# Master MOC (Map of Content) - JullSir Project Artifacts

본 문서는 JullSir 프로젝트 내 산출물(요청사항 REQ, 제품기획 PRD, 상세설계 SDS, 검증 TST, 결함 ERR)의 상호 연결 관계와 인덱스를 총괄 관리하는 마스터 맵이다.

---

## 1. 산출물 인덱스 (Project Artifact Index)

| 도메인 / 구분 | 요청사항 (`REQ`) | 기획 명세서 (`PRD`) | 상세 설계서 (`SDS`) | 자동화 테스트 (`TST`) |
|---|---|---|---|---|
| **실시간 알림 및 대기열** | [req_2026_10.md](requests/req_2026_10.md), [req_2026_11.md](requests/req_2026_11.md) | [prd_queue_notification.md](proposals/prd_queue_notification.md) | [sds_queue_notification.md](design/sds_queue_notification.md) | [tests/notificationAlert.test.ts](../tests/notificationAlert.test.ts) |

---

## 2. Graph Database JSON Index

```json
{
  "version": "1.0.0",
  "updated_at": "2026-10-31T23:30:00Z",
  "keywords": {
    "notification": [
      "agent_documents/proposals/prd_queue_notification.md"
    ],
    "wake_lock": [
      "agent_documents/proposals/prd_queue_notification.md"
    ],
    "web_push": [
      "agent_documents/proposals/prd_queue_notification.md"
    ],
    "pwa": [
      "agent_documents/proposals/prd_queue_notification.md"
    ]
  },
  "nodes": [
    {
      "id": "REQ26103102",
      "path": "agent_documents/requests/req_2026_10.md",
      "domain": "notification"
    },
    {
      "id": "PRD26103100",
      "path": "agent_documents/proposals/prd_queue_notification.md",
      "domain": "notification"
    },
    {
      "id": "PRD26103101",
      "path": "agent_documents/proposals/prd_queue_notification.md",
      "domain": "notification"
    },
    {
      "id": "PRD26103102",
      "path": "agent_documents/proposals/prd_queue_notification.md",
      "domain": "notification"
    },
    {
      "id": "PRD26103103",
      "path": "agent_documents/proposals/prd_queue_notification.md",
      "domain": "notification"
    },
    {
      "id": "PRD26103104",
      "path": "agent_documents/proposals/prd_queue_notification.md",
      "domain": "notification"
    }
  ],
  "edges": [
    {
      "source": "REQ26103102",
      "target": "PRD26103101",
      "relation": "modifies"
    },
    {
      "source": "REQ26103102",
      "target": "PRD26103102",
      "relation": "modifies"
    },
    {
      "source": "REQ26103102",
      "target": "PRD26103103",
      "relation": "modifies"
    },
    {
      "source": "REQ26103102",
      "target": "PRD26103104",
      "relation": "modifies"
    }
  ]
}
```
