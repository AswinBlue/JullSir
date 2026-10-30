#!/usr/bin/env bash
# JullSir 단위 테스트 실행 스크립트 (Linux / macOS / Git Bash)

echo "========================================"
echo "  JullSir(줄서) 로직 및 단위 테스트 실행"
echo "========================================"

if [ "$1" == "--watch" ] || [ "$1" == "-w" ]; then
    echo "👀 Watch 모드로 테스트를 실행합니다..."
    if command -v pnpm &> /dev/null; then
        pnpm run test:watch
    else
        corepack pnpm@9 run test:watch
    fi
else
    echo "🚀 단위 테스트 1회 완주 실행 중..."
    if command -v pnpm &> /dev/null; then
        pnpm test
    else
        corepack pnpm@9 run test
    fi
fi
