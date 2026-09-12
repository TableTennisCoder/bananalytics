#!/usr/bin/env bash
#
# Bananalytics installer.
#
#   curl -fsSL https://bananalytics.xyz/install.sh | sudo bash
#
# Installs Docker if it is missing, writes a configuration, pulls the published
# images and starts the stack. Running it again upgrades in place and never
# touches your existing configuration or data.
#
# Non-interactive, for automation:
#   curl -fsSL … | sudo bash -s -- --domain analytics.example.com --yes
#
set -euo pipefail

# Where the compose file and Caddyfile are fetched from once this is running.
# The same origin that served this script, so an install cannot get halfway and
# then stall on a second host. Override it to install from a fork:
#   BANANA_BASE_URL=https://raw.githubusercontent.com/you/bananalytics/main
readonly BASE_URL="${BANANA_BASE_URL:-https://bananalytics.xyz}"
readonly RAW_BASE="${BASE_URL}/deploy"

# Not readonly: --dir overrides it during argument parsing.
INSTALL_DIR="${BANANA_INSTALL_DIR:-/opt/bananalytics}"

VERSION="${BANANA_VERSION:-latest}"
DOMAIN="${BANANA_DOMAIN:-}"
RETENTION="${BANANA_RAW_RETENTION_MONTHS:-0}"
ASSUME_YES=0
UNINSTALL=0
BEHIND_PROXY=0
PROXY_PORT=9000

# ── Output ───────────────────────────────────────────────────────────────────
#
# A vertical rail ties the run together: at a glance you can see what has
# already happened and what is happening now. Steps hang off it as diamonds,
# the way the better CLI installers read.

# Colour only when stdout is a terminal, so piping to a file stays readable.
if [ -t 1 ]; then
    C_RESET=$'[0m'; C_BOLD=$'[1m'; C_DIM=$'[2m'
    C_RED=$'[31m';  C_GREEN=$'[32m'; C_YELLOW=$'[33m'
else
    C_RESET=''; C_BOLD=''; C_DIM=''; C_RED=''; C_GREEN=''; C_YELLOW=''
fi

# Box-drawing by default; BANANA_ASCII=1 for a terminal that cannot show it.
# The locale is not consulted on purpose — whether these glyphs render is a
# property of the terminal, and a fresh server often has no locale set at all.
if [ "${BANANA_ASCII:-0}" = "1" ]; then
    M_BAR='|'; M_STEP='o'; M_ACTIVE='*'; M_TOP='.'; M_END="'"; M_PICK='>'
    M_ON='[x]'; M_OFF='[ ]'; M_ART=0
else
    M_BAR='│'; M_STEP='◇'; M_ACTIVE='◆'
    M_TOP='┌'; M_END='└'; M_PICK='❯'
    # A box in front of every option says "there is something to pick here"
    # before anyone reads a word of it. The filled one is the current choice.
    M_ON='◼'; M_OFF='☐'; M_ART=1
fi

# The rail, in dim, as a prefix for everything below a step.
rail() { printf '%s%s%s' "$C_DIM" "$M_BAR" "$C_RESET"; }

banner() {
    local cols
    cols="$(tput cols 2> /dev/null || echo 80)"

    printf '
'
    if [ "$M_ART" -eq 1 ] && [ "$cols" -ge 74 ]; then
        printf '%s' "$C_YELLOW"
        cat <<'ART'
████   ███  █   █  ███  █   █  ███  █     █   █ █████ █████  ████  ████
█   █ █   █ ██  █ █   █ ██  █ █   █ █      █ █    █     █   █     █    
████  █████ █ █ █ █████ █ █ █ █████ █       █     █     █   █      ███ 
█   █ █   █ █  ██ █   █ █  ██ █   █ █       █     █     █   █         █
████  █   █ █   █ █   █ █   █ █   █ █████   █     █   █████  ████ ████ 
ART
        printf '%s
' "$C_RESET"
    else
        printf '  %s%sBANANALYTICS%s

' "$C_BOLD" "$C_YELLOW" "$C_RESET"
    fi
    printf '  %sself-hosted analytics for React Native%s

' "$C_DIM" "$C_RESET"
    printf '%s%s%s  %sInstaller%s
' "$C_DIM" "$M_TOP" "$C_RESET" "$C_BOLD" "$C_RESET"
}

# step marks what is happening now; everything after it hangs off the rail.
step() {
    printf '%s
%s%s%s  %s%s%s
' "$(rail)" "$C_GREEN" "$M_ACTIVE" "$C_RESET" "$C_BOLD" "$1" "$C_RESET"
}

# done_step marks something already finished.
done_step() {
    printf '%s
%s%s%s  %s
' "$(rail)" "$C_GREEN" "$M_STEP" "$C_RESET" "$1"
}

info() { printf '%s  %s
' "$(rail)" "$1"; }
dim()  { printf '%s  %s%s%s
' "$(rail)" "$C_DIM" "$1" "$C_RESET"; }
warn() { printf '%s
%s%s%s  %s%s
' "$(rail)" "$C_YELLOW" "$M_ACTIVE" "$C_RESET" "$1" "$C_RESET" >&2; }

die() {
    printf '%s
%s%s  %s%s

' "$(rail)" "$C_RED" "$M_END" "$1" "$C_RESET" >&2
    exit 1
}

# finish closes the rail.
finish() { printf '%s
%s%s%s  %s%s%s

' "$(rail)" "$C_GREEN" "$M_END" "$C_RESET" "$C_BOLD" "$1" "$C_RESET"; }

# ── Interaction ──────────────────────────────────────────────────────────────
#
# Two constraints shape everything here.
#
# When this script is piped into bash, stdin is the script itself, so a bare
# `read` would consume the script's own text rather than wait for the user.
# Every prompt therefore reads the terminal directly.
#
# And nothing reads inside a command substitution. `$(...)` runs a subshell,
# where an `exit` ends only that subshell and leaves the script running with an
# empty answer — and where a Ctrl-C caught by `read` is swallowed by the `||`
# that follows it, so a retry loop just asks again and the user cannot get out.
# Prompts set a global instead, which keeps them in the current shell.

# Testing permissions is not enough: /dev/tty exists in a container started
# without a terminal, and passes -r and -w, but opening it fails. So open it.
have_tty() { (exec 3<> /dev/tty) 2> /dev/null; }

# Answers land here, set by ask, ask_again and choose_option.
REPLY_VALUE=""
CHOICE=0

# cancelled ends the run the way the user asked it to.
cancelled() {
    printf '\n%s !! Cancelled. Nothing was changed.%s\n\n' "$C_YELLOW" "$C_RESET" >&2
    exit 130
}
trap cancelled INT TERM

# read_tty reads one line, telling an interrupt apart from an empty answer.
# A signal makes read exit above 128, and noticing that is the only way to catch
# a Ctrl-C the terminal handed to the read rather than to the shell.
read_tty() {
    local status=0
    IFS= read -r REPLY_VALUE < /dev/tty || status=$?
    [ "$status" -gt 128 ] && cancelled
    return 0
}

ask() {
    local prompt="$1" default="${2:-}"
    if ! have_tty || [ "$ASSUME_YES" -eq 1 ]; then
        REPLY_VALUE="$default"
        return
    fi
    if [ -n "$default" ]; then
        printf '%s%s%s [%s]: ' "$C_BOLD" "$prompt" "$C_RESET" "$default" > /dev/tty
    else
        printf '%s%s%s: ' "$C_BOLD" "$prompt" "$C_RESET" > /dev/tty
    fi
    read_tty
    [ -n "$REPLY_VALUE" ] || REPLY_VALUE="$default"
}

confirm() {
    local prompt="$1"
    [ "$ASSUME_YES" -eq 1 ] && return 0
    have_tty || return 0
    printf '%s%s%s [y/N]: ' "$C_BOLD" "$prompt" "$C_RESET" > /dev/tty
    read_tty
    case "$REPLY_VALUE" in [yY]|[yY][eE][sS]) return 0 ;; *) return 1 ;; esac
}

# ask_again keeps asking until the answer is usable.
#
# An interactive prompt that aborts on a typo is the wrong shape: this script is
# normally run as `curl … | sudo bash`, so "start over" means re-running the
# whole pipeline. Someone who mistypes a domain should get another go at it.
ask_again() {
    local prompt="$1" validator="$2" hint="$3"
    local tries=0

    while [ "$tries" -lt 8 ]; do
        ask "$prompt" ''
        if [ -n "$REPLY_VALUE" ] && "$validator" "$REPLY_VALUE"; then
            return 0
        fi
        tries=$((tries + 1))
        printf '    %s%s%s\n' "$C_YELLOW" "$hint" "$C_RESET" > /dev/tty
    done

    die "No usable answer after $tries attempts. Pass --domain analytics.example.com instead."
}

# choose_option renders a list you move through with the arrow keys and leaves
# the selected index in CHOICE.
#
# Options arrive as triples of label and two explanation lines, so the block it
# redraws is always the same height and the cursor can be put back over it
# exactly. Falls back to a numbered prompt where single keystrokes are not
# available — a terminal that cannot do this should still answer the question.
choose_option() {
    local -a labels=() detail1=() detail2=()
    while [ "$#" -ge 3 ]; do
        labels+=("$1"); detail1+=("$2"); detail2+=("$3")
        shift 3
    done

    local count=${#labels[@]}
    CHOICE=0
    [ "$count" -gt 0 ] || return 0

    if ! have_tty || [ "$ASSUME_YES" -eq 1 ]; then
        return 0
    fi

    # One line per option, a blank, two detail lines, and the key hint.
    local height=$((count + 4))
    local i key rest drawn=0

    while :; do
        [ "$drawn" -eq 1 ] && printf '\033[%dA' "$height" > /dev/tty
        drawn=1

        for i in $(seq 0 $((count - 1))); do
            if [ "$i" -eq "$CHOICE" ]; then
                printf '\033[2K%s  %s%s %s%s %s%s\n' "$(rail)" \
                    "$C_GREEN" "$M_PICK" "$M_ON" "$C_RESET" "$C_BOLD" "${labels[$i]}$C_RESET" > /dev/tty
            else
                printf '\033[2K%s    %s%s %s%s\n' "$(rail)" \
                    "$C_DIM" "$M_OFF" "${labels[$i]}" "$C_RESET" > /dev/tty
            fi
        done

        printf '\033[2K%s\n' "$(rail)" > /dev/tty
        printf '\033[2K%s    %s%s%s\n' "$(rail)" "$C_DIM" "${detail1[$CHOICE]}" "$C_RESET" > /dev/tty
        printf '\033[2K%s    %s%s%s\n' "$(rail)" "$C_DIM" "${detail2[$CHOICE]}" "$C_RESET" > /dev/tty
        printf '\033[2K%s  %s%s%s\n' "$(rail)" "$C_DIM" "Arrows to move, Enter to choose" "$C_RESET" > /dev/tty

        # A single keystroke, unechoed: otherwise the arrows print their escape
        # codes over the menu being drawn.
        if ! IFS= read -rsn1 key < /dev/tty; then
            printf '\n' > /dev/tty
            ask_again 'Choose' is_in_range "Enter a number from 1 to ${count}"
            CHOICE=$((REPLY_VALUE - 1))
            return 0
        fi

        case "$key" in
            '') return 0 ;;
            $'\033')
                # An arrow arrives as ESC [ A or ESC [ B. The rest is read with a
                # timeout so a lone Escape does not wedge the menu.
                IFS= read -rsn2 -t 0.1 rest < /dev/tty || rest=''
                case "$rest" in
                    '[A') CHOICE=$(( (CHOICE - 1 + count) % count )) ;;
                    '[B') CHOICE=$(( (CHOICE + 1) % count )) ;;
                esac
                ;;
            k) CHOICE=$(( (CHOICE - 1 + count) % count )) ;;
            j) CHOICE=$(( (CHOICE + 1) % count )) ;;
            [1-9])
                if [ "$key" -le "$count" ]; then
                    CHOICE=$((key - 1))
                    return 0
                fi
                ;;
            q) cancelled ;;
        esac
    done
}

is_in_range() {
    case "$1" in
        ''|*[!0-9]*) return 1 ;;
        *) [ "$1" -ge 1 ] && [ "$1" -le 9 ] ;;
    esac
}

# looks_like_host accepts a hostname or an IP: letters, digits, dots and
# hyphens, and nothing else that could reach a shell.
looks_like_host() {
    case "$1" in
        *[!a-zA-Z0-9.-]*) return 1 ;;
        -*|.*) return 1 ;;
        *) return 0 ;;
    esac
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

  --domain <host>      Address to serve from: a domain, or this server's IP
  --version <tag>      Image tag to install (default: latest)
  --retention <n>      Months of raw events to keep; 0 keeps them forever.
                       Rarely wanted at install time — change it in .env later.
  --behind-proxy <p>   This machine already serves 80/443. Listen on
                       127.0.0.1:<p> over plain HTTP instead and let the
                       existing proxy forward to it and terminate TLS.
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

    # Read in a subshell, one value at a time, rather than sourced into this one.
    # /etc/os-release assigns plain shell variables — NAME, ID, and VERSION among
    # them — so sourcing it overwrites any of this script's own that share a name.
    # VERSION did: it became "26.04.1 LTS (Resolute Raccoon)" and went straight to
    # docker pull as an image tag.
    # shellcheck disable=SC1091
    OS_ID="$(. /etc/os-release 2> /dev/null && printf '%s' "${ID:-unknown}")"
    # shellcheck disable=SC1091
    OS_NAME="$(. /etc/os-release 2> /dev/null && printf '%s' "${PRETTY_NAME:-${ID:-unknown}}")"
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

# port_in_use reports whether something already listens on a TCP port.
# Returns false when neither tool is available rather than guessing — Docker
# will report the conflict itself in that case, just less helpfully.
port_in_use() {
    local port="$1"
    if command -v ss > /dev/null 2>&1; then
        ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}\$"
    elif command -v netstat > /dev/null 2>&1; then
        netstat -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}\$"
    else
        return 1
    fi
}

# check_ports stops before Docker does, with an explanation Docker cannot give.
#
# A server that already hosts something is the common case this hits: nginx or
# Apache holds 80 and 443, and "port is already allocated" tells the user
# nothing about what to do next.
check_ports() {
    [ "$BEHIND_PROXY" -eq 0 ] || return 0

    local busy=''
    port_in_use 80 && busy='80'
    port_in_use 443 && busy="${busy:+${busy} and }443"
    [ -n "$busy" ] || return 0

    local holder=''
    if command -v ss > /dev/null 2>&1; then
        holder="$(ss -ltnp 2>/dev/null | grep -E '[:.](80|443)\s' | grep -oE 'users:\(\("[^"]+' | grep -oE '"[^"]+' | tr -d '"' | sort -u | tr '\n' ' ')"
    fi

    printf '\n'
    warn "Port ${busy} is already in use${holder:+ by: ${holder}}."
    info "Caddy needs 80 and 443 to serve traffic and obtain certificates, so"
    info "this install would fail as soon as it tried to start."
    printf '\n'
    info "If this machine already runs a web server, install behind it instead:"
    printf '\n'
    printf '        %s--behind-proxy 9000%s\n' "$C_BOLD" "$C_RESET"
    printf '\n'
    info "Everything then listens on 127.0.0.1:9000 over plain HTTP, and your"
    info "existing proxy forwards a hostname to it and terminates TLS itself."
    printf '\n'
    die "Stopped without changing anything."
}

is_ip() {
    case "$1" in
        *[!0-9.]*) return 1 ;;
        *.*.*.*) return 0 ;;
        *) return 1 ;;
    esac
}

# public_ip is the address someone would reach this machine on. The routing
# table is asked first so the common case needs no network call at all.
public_ip() {
    local ip=''
    if command -v ip > /dev/null 2>&1; then
        ip="$(ip -4 -o addr show scope global 2>/dev/null | awk '{split($4,a,"/"); print a[1]; exit}')"
    fi
    [ -n "$ip" ] || ip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
    printf '%s' "$ip"
}

# choose_address asks where this install will be reachable.
#
# The address cannot wait until after setup, because it is what the certificate
# is issued for, and the first page anyone opens is the one where they choose an
# admin password. Asking here is what keeps that password off the wire in clear
# text — the alternative, serving the setup page over plain HTTP on an IP, hands
# it to anyone on the path.
choose_address() {
    local ip
    ip="$(public_ip)"

    if ! have_tty || [ "$ASSUME_YES" -eq 1 ]; then
        die "No terminal to ask where this should be reachable. Pass --domain analytics.example.com"
    fi

    # Behind an existing proxy there is nothing to choose: that proxy serves a
    # hostname and forwards here, so a bare IP would never be what is wanted.
    if [ "$BEHIND_PROXY" -eq 1 ]; then
        printf '\n'
        info "Which hostname will your existing proxy serve this on?"
        info "Used for links and for the allowed browser origin, not for TLS —"
        info "your proxy handles that."
        printf '\n'
        ask_again 'Hostname' looks_like_host 'A hostname, e.g. analytics.example.com'
        DOMAIN="$REPLY_VALUE"
        return
    fi

    printf '%s\n' "$(rail)"
    info "Where will this be reachable?"
    printf '%s\n' "$(rail)"

    choose_option \
        "A domain you control" \
        "Encrypted with a real certificate from the first request." \
        "Its DNS A record has to point here already." \
        "This server's IP  —  ${ip:-unknown}" \
        "Works right now, no DNS needed. Still encrypted, but your browser" \
        "warns once: no authority can vouch for an IP. Move to a domain later."

    if [ "$CHOICE" -eq 1 ]; then
        [ -n "$ip" ] || die "Could not determine this machine's IP address. Pass --domain instead."
        DOMAIN="$ip"
        printf '\n'
        warn "Your browser will warn about the certificate on first visit."
        info "That is expected — the connection is encrypted, but no public"
        info "authority can certify an IP address. Verify it is your server,"
        info "then continue. Re-run with --domain later to switch."
        return
    fi

    printf '\n'
    ask_again 'Domain' looks_like_host \
        'A domain, e.g. analytics.example.com — Ctrl-C to start over'
    DOMAIN="$REPLY_VALUE"
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
    local site_address http_bind https_bind

    if [ "$BEHIND_PROXY" -eq 1 ]; then
        # Loopback only: the proxy in front is the only thing that should reach
        # this, and binding it publicly would expose an unencrypted port.
        site_address="http://:${PROXY_PORT}"
        http_bind="127.0.0.1:${PROXY_PORT}:${PROXY_PORT}"
        # Compose needs a value for the second mapping, but nothing listens on
        # 443 in this mode. It goes to the next loopback port, where it is
        # unreachable from outside and forwards to a closed container port.
        https_bind="127.0.0.1:$((PROXY_PORT + 1)):443"
    else
        site_address="$domain"
        http_bind="80:80"
        https_bind="443:443"
    fi

    umask 077
    cat > "${INSTALL_DIR}/.env" <<EOF
# Written by install.sh on $(date -u '+%Y-%m-%d %H:%M:%S UTC').
# Re-running the installer never overwrites this file.

# The address this is reached at.
BANANA_DOMAIN=${domain}

# What Caddy binds and serves. With a hostname here it obtains its own
# certificate. As http://:PORT it serves plain HTTP for a reverse proxy that
# already terminates TLS in front of it.
BANANA_SITE_ADDRESS=${site_address}
BANANA_HTTP_BIND=${http_bind}
BANANA_HTTPS_BIND=${https_bind}

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
            --behind-proxy)   BEHIND_PROXY=1; PROXY_PORT="${2:-9000}"; shift 2 ;;
            --behind-proxy=*) BEHIND_PROXY=1; PROXY_PORT="${1#*=}"; shift ;;
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
    # A tag is letters, digits, dots, underscores and hyphens, and starts with an
    # alphanumeric. Checked rather than assumed: this is the value that reaches
    # `docker pull`, and the one time it held something else it held the output
    # of /etc/os-release.
    case "$VERSION" in
        '') die "--version needs a tag, e.g. --version v0.2.1" ;;
        [A-Za-z0-9]*) ;;
        *) die "--version must start with a letter or digit, got: $VERSION" ;;
    esac
    case "$VERSION" in
        *[!A-Za-z0-9._-]*) die "--version is not a valid image tag: $VERSION" ;;
    esac
    if [ "$BEHIND_PROXY" -eq 1 ]; then
        case "$PROXY_PORT" in
            ''|*[!0-9]*) die "--behind-proxy needs a port number, got: $PROXY_PORT" ;;
        esac
        # The next port up is used as well, so stop short of the ceiling.
        if [ "$PROXY_PORT" -lt 1024 ] || [ "$PROXY_PORT" -gt 65534 ]; then
            die "--behind-proxy port must be between 1024 and 65534, got: $PROXY_PORT"
        fi
    fi
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
        die "No terminal available to ask where this should be reachable. Pass --domain analytics.example.com"
    fi

    banner
    done_step "$OS_NAME · $ARCH"
    dim "Installing to $INSTALL_DIR"

    require_tools
    [ "$upgrading" -eq 1 ] || check_ports
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

        [ -n "$DOMAIN" ] || choose_address
        [ -n "$DOMAIN" ] || die "An address is required."

        if ! is_ip "$DOMAIN"; then
            printf '\n'
            if ! check_dns "$DOMAIN"; then
                printf '\n'
                if ! confirm "Continue anyway"; then
                    die "Stopped. Point $DOMAIN at this machine and run the installer again."
                fi
            fi
        fi

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

    local address url
    address="$(grep '^BANANA_DOMAIN=' "${INSTALL_DIR}/.env" | cut -d= -f2-)"
    url="https://${address}"

    if [ "$upgrading" -eq 1 ]; then
        done_step "Upgraded in place"
        dim "Your data and configuration were not touched."
    else
        done_step "Running"
        printf '%s  Open %s%s/setup%s to create your account.\n' "$(rail)" "$C_BOLD" "$url" "$C_RESET"
        printf '%s\n' "$(rail)"
        if is_ip "$address"; then
            dim "Your browser will warn about the certificate. That is expected for"
            dim "an IP address — the connection is encrypted regardless. To switch"
            dim "to a domain later, re-run this installer with --domain."
        else
            dim "A TLS certificate is issued on the first request and can take a moment."
        fi
    fi
    printf '%s\n' "$(rail)"
    dim "Config    ${INSTALL_DIR}/.env"
    dim "Logs      docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f"
    dim "Upgrade   re-run this installer"
    finish "Done"
}

main "$@"
