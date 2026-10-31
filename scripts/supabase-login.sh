#!/usr/bin/env bash
# scripts/supabase-login.sh
# Supabase CLI Login & Project Link script using .env / .env.local

set -e

echo "========================================"
echo "  JullSir Supabase CLI Login & Link"
echo "========================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

ENV_FILE=""
if [ -f "$ROOT_DIR/.env.local" ]; then
    ENV_FILE="$ROOT_DIR/.env.local"
    echo "[INFO] Found .env.local"
elif [ -f "$ROOT_DIR/.env" ]; then
    ENV_FILE="$ROOT_DIR/.env"
    echo "[INFO] Found .env"
fi

PROJECT_ID=""
if [ -n "$ENV_FILE" ]; then
    PROJECT_ID=$(grep -E "^SUPABASE_PROJECT_ID=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
    if [ -z "$PROJECT_ID" ]; then
        URL=$(grep -E "^VITE_SUPABASE_URL=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
        if [[ "$URL" =~ https://([a-zA-Z0-9_-]+)\.supabase\.co ]]; then
            PROJECT_ID="${BASH_REMATCH[1]}"
        fi
    fi
fi

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "your-project-id" ]; then
    read -p "Enter Supabase Project ID: " PROJECT_ID
fi

if [ -z "$PROJECT_ID" ]; then
    echo "[ERROR] Project ID is required."
    exit 1
fi

echo "[INFO] Target Project ID: $PROJECT_ID"

# Prefer pnpm dlx to avoid Node 24 minipass/npm bug
SUPABASE_CMD="pnpm dlx supabase"
if ! command -v pnpm &> /dev/null; then
    if command -v corepack &> /dev/null; then
        SUPABASE_CMD="corepack pnpm@9 dlx supabase"
    else
        SUPABASE_CMD="npx supabase"
    fi
fi

echo "[1/2] Logging in to Supabase CLI..."
$SUPABASE_CMD login

echo "[2/2] Linking project: $PROJECT_ID..."
$SUPABASE_CMD link --project-ref "$PROJECT_ID"

echo ""
echo "[SUCCESS] Supabase project successfully linked!"
echo "[TIP] To deploy edge function, run: ./scripts/supabase-deploy.sh"
