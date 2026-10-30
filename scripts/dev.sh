#!/usr/bin/env bash
# JullSir 로컬 개발 서버 실행 스크립트 (Linux / macOS / Git Bash)

echo "========================================"
echo "  JullSir(줄서) 로컬 개발 서버 시작"
echo "========================================"
echo "URL: http://localhost:3000/Jullsir/"
echo ""

if command -v pnpm &> /dev/null; then
    pnpm dev
else
    corepack pnpm@9 dev
fi
