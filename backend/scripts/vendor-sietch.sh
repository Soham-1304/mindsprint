#!/usr/bin/env bash
set -euo pipefail

# Vendors compiled @sietch/core and @sietch/sandbox dist/ artifacts into
# sre-agent/backend/vendor/sietch/ for cloud Docker builds (Render/Railway/GCP)
# where /Users/sohamkarandikar/Documents/Kiroween is not present on disk.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
KIROWEEN_DIR="${KIROWEEN_DIR:-/Users/sohamkarandikar/Documents/Kiroween}"
VENDOR_DIR="${BACKEND_DIR}/vendor/sietch"

if [[ ! -d "${KIROWEEN_DIR}/base/core/dist" || ! -d "${KIROWEEN_DIR}/base/sandbox/dist" ]]; then
  echo "ERROR: Could not find compiled Kiroween dist/ directories under ${KIROWEEN_DIR}" >&2
  echo "Ensure @sietch/core and @sietch/sandbox are built, or set KIROWEEN_DIR=/path/to/Kiroween." >&2
  exit 1
fi

rm -rf "${VENDOR_DIR}"
mkdir -p "${VENDOR_DIR}/base/core" "${VENDOR_DIR}/base/sandbox"

cp -R "${KIROWEEN_DIR}/base/core/dist" "${VENDOR_DIR}/base/core/dist"
cp -R "${KIROWEEN_DIR}/base/sandbox/dist" "${VENDOR_DIR}/base/sandbox/dist"

if [[ -f "${KIROWEEN_DIR}/base/core/package.json" ]]; then
  cp "${KIROWEEN_DIR}/base/core/package.json" "${VENDOR_DIR}/base/core/package.json"
fi
if [[ -f "${KIROWEEN_DIR}/base/sandbox/package.json" ]]; then
  cp "${KIROWEEN_DIR}/base/sandbox/package.json" "${VENDOR_DIR}/base/sandbox/package.json"
fi

echo "Vendored @sietch/core and @sietch/sandbox into ${VENDOR_DIR}"
