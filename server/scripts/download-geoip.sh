#!/usr/bin/env bash
# download-geoip.sh — Downloads the MaxMind GeoLite2-City database for Bananalytics.
#
# Usage:
#   MAXMIND_LICENSE_KEY=xxx ./scripts/download-geoip.sh
#
# Or set MAXMIND_LICENSE_KEY in your .env and run:
#   ./scripts/download-geoip.sh
#
# Get a free license key: https://www.maxmind.com/en/geolite2/signup
# (Sign up → My License Key → Generate new license key)
#
# Output: ./geoip/GeoLite2-City.mmdb
#
# To use: set BANANA_GEOIP_DB=/app/geoip/GeoLite2-City.mmdb in your env
# (or mount this directory as a Docker volume).

set -euo pipefail

# Load .env if it exists and key isn't already set
if [ -z "${MAXMIND_LICENSE_KEY:-}" ] && [ -f ".env" ]; then
    # shellcheck disable=SC1091
    set -a; . ./.env; set +a
fi

if [ -z "${MAXMIND_LICENSE_KEY:-}" ]; then
    echo "ERROR: MAXMIND_LICENSE_KEY environment variable is required."
    echo ""
    echo "Get a free license key at:"
    echo "  https://www.maxmind.com/en/geolite2/signup"
    echo ""
    echo "Then either:"
    echo "  export MAXMIND_LICENSE_KEY=your_key_here"
    echo "  ./scripts/download-geoip.sh"
    echo ""
    echo "Or add to .env:"
    echo "  MAXMIND_LICENSE_KEY=your_key_here"
    exit 1
fi

GEOIP_DIR="./geoip"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$GEOIP_DIR"

DOWNLOAD_URL="https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz"

echo "Downloading MaxMind GeoLite2-City database..."
if ! curl -fsSL -o "$TMP_DIR/geoip.tar.gz" "$DOWNLOAD_URL"; then
    echo "ERROR: Download failed. Check your license key."
    exit 1
fi

echo "Extracting..."
tar -xzf "$TMP_DIR/geoip.tar.gz" -C "$TMP_DIR"

# Find the .mmdb file (path includes a date-stamped folder)
MMDB_PATH="$(find "$TMP_DIR" -name "GeoLite2-City.mmdb" | head -1)"
if [ -z "$MMDB_PATH" ]; then
    echo "ERROR: GeoLite2-City.mmdb not found in archive."
    exit 1
fi

mv "$MMDB_PATH" "$GEOIP_DIR/GeoLite2-City.mmdb"

SIZE="$(du -h "$GEOIP_DIR/GeoLite2-City.mmdb" | cut -f1)"
echo ""
echo "✓ Done! Database saved to: $GEOIP_DIR/GeoLite2-City.mmdb ($SIZE)"
echo ""
echo "Next steps:"
echo "  1. Set in your env: BANANA_GEOIP_DB=/app/geoip/GeoLite2-City.mmdb"
echo "     (already mounted in docker-compose.yml)"
echo "  2. Restart the server: docker-compose restart bananalytics"
echo ""
echo "Tip: MaxMind updates the database weekly. Re-run this script monthly to stay current."
