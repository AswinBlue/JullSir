#!/usr/bin/env bash
# scripts/supabase-secrets.sh
# Set Supabase Secrets without Docker or npm/npx bug

set -e

echo "========================================"
echo "  JullSir Supabase Secrets Manager"
echo "========================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

ENV_FILE=""
if [ -f "$ROOT_DIR/.env.local" ]; then
    ENV_FILE="$ROOT_DIR/.env.local"
elif [ -f "$ROOT_DIR/.env" ]; then
    ENV_FILE="$ROOT_DIR/.env"
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

SECRET_ARG="$1"
if [ -z "$SECRET_ARG" ]; then
    read -p "Enter secret pair to set (e.g. RESEND_API_KEY=re_xxxx): " SECRET_ARG
fi

if [ -z "$SECRET_ARG" ]; then
    echo "[ERROR] Secret pair is required."
    exit 1
fi

if [[ "$SECRET_ARG" =~ ^re_[a-zA-Z0-9_-]+$ ]]; then
    SECRET_ARG="RESEND_API_KEY=$SECRET_ARG"
fi

echo "[INFO] Setting secret on project $PROJECT_ID..."

SUPABASE_CMD="pnpm dlx supabase"
if ! command -v pnpm &> /dev/null; then
    if command -v corepack &> /dev/null; then
        SUPABASE_CMD="corepack pnpm@9 dlx supabase"
    else
        SUPABASE_CMD="npx supabase"
    fi
fi

$SUPABASE_CMD secrets set "$SECRET_ARG" --project-ref "$PROJECT_ID"

echo ""
echo "[SUCCESS] Supabase secret set successfully!"
