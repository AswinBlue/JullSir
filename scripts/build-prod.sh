#!/usr/bin/env bash
# JullSir 운영 빌드 스크립트 (Linux / macOS / Git Bash)
set -e

echo "========================================"
echo "  JullSir(줄서) 프로덕션 운영 빌드 시작"
echo "========================================"

echo "[1/2] TypeScript 타입 무결성 검증 중..."
if command -v pnpm &> /dev/null; then
    pnpm typecheck
else
    corepack pnpm@9 run typecheck
fi

echo "[2/2] Vite 프로덕션 번들 빌드 중..."
if command -v pnpm &> /dev/null; then
    pnpm build
else
    corepack pnpm@9 run build
fi

echo ""
echo "✅ 운영 빌드가 성공적으로 완료되었습니다! (dist/)"
ls -lh dist/
