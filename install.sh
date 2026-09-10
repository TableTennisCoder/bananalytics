#!/usr/bin/env bash
#
# Bananalytics installer.
#
#   curl -fsSL https://raw.githubusercontent.com/TableTennisCoder/bananalytics/main/install.sh | sudo bash
#
# Installs Docker if it is missing, writes a configuration, pulls the published
# images and starts the stack. Running it again upgrades in place and never
# touches your existing configuration or data.
#
# Non-interactive, for automation:
#   curl -fsSL … | sudo bash -s -- --domain analytics.example.com --yes
#
set -euo pipefail

readonly REPO="TableTennisCoder/bananalytics"
readonly RAW_BASE="https://raw.githubusercontent.com/${REPO}/main/deploy"

# Not readonly: --dir overrides it during argument parsing.
INSTALL_DIR="${BANANA_INSTALL_DIR:-/opt/bananalytics}"

VERSION="${BANANA_VERSION:-latest}"
DOMAIN="${BANANA_DOMAIN:-}"
RETENTION="${BANANA_RAW_RETENTION_MONTHS:-0}"
ASSUME_YES=0
UNINSTALL=0

# ── Output ───────────────────────────────────────────────────────────────────
# Colour only when stdout is a terminal, so piping to a file stays readable.
if [ -t 1 ]; then
    C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
    C_RED=$'\033[31m';  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
else
    C_RESET=''; C_BOLD=''; C_DIM=''; C_RED=''; C_GREEN=''; C_YELLOW=''
fi

step() { printf '\n%s==>%s %s%s%s\n' "$C_GREEN" "$C_RESET" "$C_BOLD" "$1" "$C_RESET"; }
info() { printf '    %s\n' "$1"; }
dim()  { printf '    %s%s%s\n' "$C_DIM" "$1" "$C_RESET"; }
warn() { printf '%s !! %s%s\n' "$C_YELLOW" "$1" "$C_RESET" >&2; }
die()  { printf '\n%s !! %s%s\n\n' "$C_RED" "$1" "$C_RESET" >&2; exit 1; }

# ── Interaction ──────────────────────────────────────────────────────────────
# When this script is piped into bash, stdin is the script itself — a bare
# `read` would consume the script's own text rather than wait for the user.
# Everything interactive therefore goes through the terminal directly.
# Testing permissions is not enough: /dev/tty exists in a container started
# without a terminal, and passes -r and -w, but opening it fails. So open it.
have_tty() { (exec 3<> /dev/tty) 2> /dev/null; }

ask() {
    local prompt="$1" default="${2:-}" answer=''
    if ! have_tty || [ "$ASSUME_YES" -eq 1 ]; then
        printf '%s' "$default"
        return
    fi
    if [ -n "$default" ]; then
        printf '%s%s%s [%s]: ' "$C_BOLD" "$prompt" "$C_RESET" "$default" > /dev/tty
    else
        printf '%s%s%s: ' "$C_BOLD" "$prompt" "$C_RESET" > /dev/tty
    fi
    IFS= read -r answer < /dev/tty || answer=''
    printf '%s' "${answer:-$default}"
}

confirm() {
    local prompt="$1"
    [ "$ASSUME_YES" -eq 1 ] && return 0
    have_tty || return 0
    printf '%s%s%s [y/N]: ' "$C_BOLD" "$prompt" "$C_RESET" > /dev/tty
    local reply=''
    IFS= read -r reply < /dev/tty || reply=''
    case "$reply" in [yY]|[yY][eE][sS]) return 0 ;; *) return 1 ;; esac
}

validate_retention() {
    case "$1" in
        ''|*[!0-9]*) die "Retention must be a whole number of months, got: $1" ;;
        0) return 0 ;;
        1) die "Retention must be 0 (keep forever) or at least 2 months." ;;
    esac
}

usage() {
    cat <<EOF
Bananalytics installer

  --domain <host>      Domain to serve from, e.g. analytics.example.com
  --version <tag>      Image tag to install (default: latest)
  --retention <n>      Months of raw events to keep; 0 keeps them forever
  --dir <path>         Install location (default: /opt/bananalytics)
  --yes                Never prompt; requires --domain on a fresh install
  --uninstall          Stop and remove the stack (asks before deleting data)
  --help               This message
EOF
}

# ── Preflight ────────────────────────────────────────────────────────────────
require_root() {
    [ "$(id -u)" -eq 0 ] || die "Run this as root: pipe it into 'sudo bash', or use 'sudo $0'."
}

detect_os() {
    [ -r /etc/os-release ] || die "Cannot read /etc/os-release — unsupported system."
    # shellcheck disable=SC1091
    . /etc/os-release
    OS_ID="${ID:-unknown}"
    OS_NAME="${PRETTY_NAME:-$OS_ID}"
    ARCH="$(uname -m)"

    case "$ARCH" in
        x86_64|amd64|aarch64|arm64) ;;
        *) die "Unsupported architecture: $ARCH. Images are published for x86_64 and arm64." ;;
    esac
}

# require_tools checks for what this script itself needs, separately from what
# it installs. A minimal server image often ships without curl, and reporting
# that as "is this machine online?" sends people looking in the wrong place.
require_tools() {
    command -v curl > /dev/null 2>&1 && return 0

    local hint
    case "$OS_ID" in
        ubuntu|debian|raspbian) hint="apt-get update && apt-get install -y curl" ;;
        fedora|centos|rhel|rocky|almalinux) hint="dnf install -y curl" ;;
        *) hint="install curl with your package manager" ;;
    esac
    die "This installer needs curl. Run: ${hint}"
}

ensure_docker() {
    if command -v docker > /dev/null 2>&1 && docker compose version > /dev/null 2>&1; then
        dim "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 'present') with the compose plugin"
        return
    fi

    if command -v docker > /dev/null 2>&1; then
        die "Docker is installed but the compose plugin is missing. Install docker-compose-plugin and re-run."
    fi

    step "Installing Docker"
    case "$OS_ID" in
        ubuntu|debian|raspbian|fedora|centos|rhel|rocky|almalinux)
            info "Using the official Docker convenience script"
            curl -fsSL https://get.docker.com -o /tmp/get-docker.sh \
                || die "Could not download the Docker installer. Is this machine online?"
            sh /tmp/get-docker.sh > /dev/null 2>&1 || die "Docker installation failed. Install it manually and re-run."
            rm -f /tmp/get-docker.sh
            ;;
        *)
            die "Automatic Docker installation is not supported on $OS_NAME. Install Docker and the compose plugin, then re-run."
            ;;
    esac

    systemctl enable --now docker > /dev/null 2>&1 || true
    docker compose version > /dev/null 2>&1 \
        || die "Docker installed but 'docker compose' is unavailable. Install docker-compose-plugin and re-run."
    info "Docker installed"
}

# ── Configuration ────────────────────────────────────────────────────────────
random_secret() {
    if command -v openssl > /dev/null 2>&1; then
        openssl rand -hex 24
    else
        # Same 48 hex characters, without depending on openssl being present.
        head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'
    fi
}

# local_ips lists the addresses this machine actually answers on.
local_ips() {
    if command -v ip > /dev/null 2>&1; then
        ip -4 -o addr show scope global 2>/dev/null | awk '{split($4,a,"/"); print a[1]}'
    fi
    curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true
}

# check_dns warns when a domain does not point here yet. It never blocks:
# records propagate, and the operator may know something we do not.
check_dns() {
    local domain="$1"
    [ "$domain" = "localhost" ] && return 0

    local resolved
    resolved="$(getent hosts "$domain" 2>/dev/null | awk '{print $1}' | head -1)"

    if [ -z "$resolved" ]; then
        warn "$domain does not resolve yet."
        info "Caddy needs it pointing at this machine before it can obtain a TLS"
        info "certificate. Create the A record, then re-run this script."
        return 1
    fi

    local ip
    for ip in $(local_ips); do
        if [ "$ip" = "$resolved" ]; then
            dim "$domain resolves to $resolved — this machine"
            return 0
        fi
    done

    warn "$domain resolves to $resolved, which does not look like this machine."
    info "If that is a proxy or load balancer in front, this is fine. Otherwise"
    info "TLS will fail until the record points here."
    return 1
}

write_env() {
    local domain="$1" retention="$2" password="$3"

    umask 077
    cat > "${INSTALL_DIR}/.env" <<EOF
# Written by install.sh on $(date -u '+%Y-%m-%d %H:%M:%S UTC').
# Re-running the installer never overwrites this file.

# The domain Caddy provisions a TLS certificate for.
BANANA_DOMAIN=${domain}

# Browser origins allowed to call the API. Native apps send no Origin header
# and are unaffected by this.
BANANA_CORS_ORIGINS=https://${domain}

# Postgres password. Only read when the data directory is first created —
# changing it later does not change the database's actual password.
BANANA_DB_PASSWORD=${password}

# Image tag to run. Pin this to a version once you are in production so an
# upgrade is something you choose rather than something that happens.
BANANA_VERSION=${VERSION}

# How often dashboard aggregates rebuild. The Live view is never stale.
BANANA_ROLLUP_INTERVAL=60s

# Months of raw events to keep. 0 keeps them forever, which is the default.
#
# When set, whole months older than the window are dropped once their
# aggregates exist. Overview, trends, breakdowns, geography, revenue and
# DAU/WAU/MAU keep their full history either way; retention cohorts, funnels,
# sessions and the event explorer only reach back as far as this window.
# Minimum is 2. There is no undo.
BANANA_RAW_RETENTION_MONTHS=${retention}

BANANA_LOG_LEVEL=info
EOF
    chmod 600 "${INSTALL_DIR}/.env"
}

fetch_files() {
    step "Fetching deployment files"
    local f
    for f in docker-compose.yml Caddyfile; do
        curl -fsSL "${RAW_BASE}/${f}" -o "${INSTALL_DIR}/${f}.new" \
            || die "Could not download ${f} from ${RAW_BASE}."
        mv "${INSTALL_DIR}/${f}.new" "${INSTALL_DIR}/${f}"
        dim "$f"
    done
    mkdir -p "${INSTALL_DIR}/geoip"
}

wait_for_health() {
    step "Waiting for the stack to come up"
    local id status
    local waited=0

    while [ "$waited" -lt 180 ]; do
        id="$(docker compose -f "${INSTALL_DIR}/docker-compose.yml" ps -q bananalytics 2>/dev/null || true)"
        if [ -n "$id" ]; then
            status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo starting)"
            case "$status" in
                healthy|running) info "Backend is up"; return 0 ;;
                exited|dead) die "The backend stopped. Check: docker compose -f ${INSTALL_DIR}/docker-compose.yml logs bananalytics" ;;
            esac
        fi
        sleep 3
        waited=$((waited + 3))
        [ $((waited % 30)) -eq 0 ] && dim "still starting (${waited}s)"
    done

    warn "The backend did not report healthy within 180 seconds."
    info "It may still be applying migrations or building its first aggregates."
    info "Check: docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f bananalytics"
    return 0
}

compose() {
    docker compose --project-directory "$INSTALL_DIR" -f "${INSTALL_DIR}/docker-compose.yml" "$@"
}

do_uninstall() {
    require_root
    [ -f "${INSTALL_DIR}/docker-compose.yml" ] || die "Nothing installed at ${INSTALL_DIR}."

    step "Stopping Bananalytics"
    compose down || true
    info "Stopped."

    printf '\n'
    if confirm "Delete all analytics data as well? This cannot be undone"; then
        compose down -v || true
        rm -rf "$INSTALL_DIR"
        info "Removed ${INSTALL_DIR} and its data."
    else
        info "Data and configuration kept in ${INSTALL_DIR}."
        info "Start again with: cd ${INSTALL_DIR} && docker compose up -d"
    fi
    exit 0
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --domain)    DOMAIN="${2:-}";    shift 2 ;;
            --domain=*)  DOMAIN="${1#*=}";   shift ;;
            --version)   VERSION="${2:-}";   shift 2 ;;
            --version=*) VERSION="${1#*=}";  shift ;;
            --retention) RETENTION="${2:-}"; shift 2 ;;
            --retention=*) RETENTION="${1#*=}"; shift ;;
            --dir)       INSTALL_DIR="${2:-}"; shift 2 ;;
            --dir=*)     INSTALL_DIR="${1#*=}"; shift ;;
            --yes|-y)    ASSUME_YES=1; shift ;;
            --uninstall) UNINSTALL=1; shift ;;
            --help|-h)   usage; exit 0 ;;
            *) die "Unknown option: $1  (try --help)" ;;
        esac
    done

    [ "$UNINSTALL" -eq 1 ] && do_uninstall

    # Everything the caller supplied is checked before anything on this machine
    # changes. Installing Docker and then rejecting an argument would leave the
    # system altered by a run that was never going to succeed.
    validate_retention "$RETENTION"
    [ -n "$VERSION" ] || die "--version needs a tag, e.g. --version v0.2.0"
    case "$INSTALL_DIR" in
        /*) ;;
        *) die "--dir must be an absolute path, got: $INSTALL_DIR" ;;
    esac
    if [ -n "$DOMAIN" ]; then
        case "$DOMAIN" in
            *[!a-zA-Z0-9.-]*) die "That does not look like a domain: $DOMAIN" ;;
        esac
    fi

    require_root
    detect_os

    local upgrading=0
    [ -f "${INSTALL_DIR}/.env" ] && upgrading=1

    # A fresh install needs a domain from somewhere. Discovering that we cannot
    # get one only after installing Docker would leave the machine changed by a
    # run that could never have finished.
    if [ "$upgrading" -eq 0 ] && [ -z "$DOMAIN" ] && { ! have_tty || [ "$ASSUME_YES" -eq 1 ]; }; then
        die "No terminal available to ask for a domain. Pass --domain analytics.example.com"
    fi

    printf '\n%s  Bananalytics%s  —  self-hosted analytics for React Native\n' "$C_BOLD" "$C_RESET"
    dim "$OS_NAME · $ARCH · installing to $INSTALL_DIR"

    require_tools
    ensure_docker
    mkdir -p "$INSTALL_DIR"

    if [ "$upgrading" -eq 1 ]; then
        step "Existing installation found"
        info "Keeping your configuration and data as they are."
        # Let --version override the pinned tag on an upgrade.
        if [ "$VERSION" != "latest" ]; then
            sed -i "s/^BANANA_VERSION=.*/BANANA_VERSION=${VERSION}/" "${INSTALL_DIR}/.env"
            info "Switching to version ${VERSION}."
        fi
    else
        step "Configuring"

        if [ -z "$DOMAIN" ]; then
            if ! have_tty && [ "$ASSUME_YES" -eq 0 ]; then
                die "No terminal to ask for a domain. Pass --domain analytics.example.com"
            fi
            info "The domain this will be served from. Its DNS A record must point"
            info "at this machine so Caddy can obtain a TLS certificate."
            printf '\n'
            DOMAIN="$(ask 'Domain' 'localhost')"
        fi
        [ -n "$DOMAIN" ] || die "A domain is required."

        printf '\n'
        if ! check_dns "$DOMAIN"; then
            printf '\n'
            if ! confirm "Continue anyway"; then
                die "Stopped. Point $DOMAIN at this machine and run the installer again."
            fi
        fi

        if [ "$RETENTION" = "0" ] && have_tty && [ "$ASSUME_YES" -eq 0 ]; then
            printf '\n'
            info "Raw events are kept forever by default. A shorter window frees disk"
            info "but limits how far back cohorts, funnels and sessions can look."
            info "Enter a number of months, or leave as 0 to keep everything."
            printf '\n'
            RETENTION="$(ask 'Keep raw events for (months)' '0')"
        fi
        validate_retention "$RETENTION"

        write_env "$DOMAIN" "$RETENTION" "$(random_secret)"
        info "Wrote ${INSTALL_DIR}/.env with a generated database password"
    fi

    fetch_files

    step "Pulling images"
    compose pull --quiet || die "Could not pull images. Check connectivity to ghcr.io."
    info "Done"

    step "Starting"
    compose up -d || die "Failed to start. Check: docker compose -f ${INSTALL_DIR}/docker-compose.yml logs"

    wait_for_health

    # shellcheck disable=SC1091
    local url
    url="https://$(grep '^BANANA_DOMAIN=' "${INSTALL_DIR}/.env" | cut -d= -f2-)"
    [ "$url" = "https://localhost" ] && url="http://localhost"

    printf '\n%s  Bananalytics is running.%s\n\n' "$C_GREEN$C_BOLD" "$C_RESET"
    if [ "$upgrading" -eq 1 ]; then
        info "Upgraded in place. Your data and configuration were not touched."
    else
        printf '    Open %s%s/setup%s to create your account.\n' "$C_BOLD" "$url" "$C_RESET"
        printf '\n'
        dim "A TLS certificate is issued on the first request and can take a moment."
    fi
    printf '\n'
    dim "Config    ${INSTALL_DIR}/.env"
    dim "Logs      docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f"
    dim "Upgrade   re-run this installer"
    printf '\n'
}

main "$@"
