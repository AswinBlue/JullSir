#!/usr/bin/env bash
# JullSir 빌드 산출물 로컬 미리보기 실행 스크립트 (Linux / macOS / Git Bash)

echo "========================================"
echo "  JullSir(줄서) 빌드 산출물 미리보기 (Preview)"
echo "========================================"

if [ ! -f "dist/index.html" ]; then
    echo "⚠️ dist 폴더가 없습니다. 먼저 운영 빌드를 진행합니다..."
    bash "$(dirname "$0")/build-prod.sh"
fi

echo "URL: http://localhost:4173/Jullsir/"
if command -v pnpm &> /dev/null; then
    pnpm preview
else
    corepack pnpm@9 run preview
fi
