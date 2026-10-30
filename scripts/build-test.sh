#!/usr/bin/env bash
# JullSir 테스트 빌드 스크립트 (Linux / macOS / Git Bash)
set -e

echo "========================================"
echo "  JullSir(줄서) 테스트 빌드 및 정합성 검증"
echo "========================================"

echo "[1/3] 단위 테스트 실행 중..."
if command -v pnpm &> /dev/null; then
    pnpm test
else
    corepack pnpm@9 run test
fi

echo "[2/3] 타입 무결성 검증 중..."
if command -v pnpm &> /dev/null; then
    pnpm typecheck
else
    corepack pnpm@9 run typecheck
fi

echo "[3/3] 테스트 모드 번들 빌드 검증 중..."
if command -v pnpm &> /dev/null; then
    pnpm run build:test
else
    corepack pnpm@9 run build:test
fi

echo ""
echo "✅ 테스트 빌드 및 정합성 검증이 모두 통과했습니다!"
