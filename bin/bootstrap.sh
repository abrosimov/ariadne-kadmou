#!/usr/bin/env bash
# Hermetic activation for ariadne-kadmou, after go-core's bin/bootstrap.sh.
#
# Turns a fresh clone on any darwin or linux host with bash, curl, tar and
# sha256sum or shasum into one where every `task` target runs:
#   1. downloads the pinned Node.js archive, verifies its SHA256 and extracts
#      it to .hermetic/stacks/node/toolchain/;
#   2. downloads the pinned Task archive, verifies its SHA256 and installs it
#      to .hermetic/stacks/node/bin/;
#   3. delegates to `task install`, which brings pnpm through Corepack and
#      the locked dependencies.
# Idempotent: a re-run verifies what is there and skips what is done. The pins
# live in pins.env, read as data and never sourced.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PINS_FILE="$REPO_ROOT/pins.env"
STACK="$REPO_ROOT/.hermetic/stacks/node"
TOOLCHAIN_DIR="$STACK/toolchain"
BIN_DIR="$STACK/bin"
CACHE_DIR="$REPO_ROOT/.hermetic/cache"

pins_load() {
	local line key seen=$'\n'
	[ -f "$PINS_FILE" ] || { echo "bootstrap: $PINS_FILE is missing" >&2; exit 1; }
	while IFS= read -r line || [ -n "$line" ]; do
		line=${line%$'\r'}
		case "$line" in '' | '#'*) continue ;; esac
		if ! [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=([^[:space:]]*)$ ]]; then
			echo "bootstrap: $PINS_FILE is not KEY=value at: $line" >&2
			exit 1
		fi
		key=${BASH_REMATCH[1]}
		case "$seen" in *$'\n'"$key"$'\n'*) echo "bootstrap: $PINS_FILE declares $key twice" >&2; exit 1 ;; esac
		seen+="$key"$'\n'
		printf -v "PIN_$key" '%s' "${BASH_REMATCH[2]}"
	done <"$PINS_FILE"
}

pin() {
	local name="PIN_$1"
	[ -n "${!name:-}" ] || { echo "bootstrap: $PINS_FILE declares no $1" >&2; exit 1; }
	printf '%s' "${!name}"
}

digest() {
	local value
	value=$(pin "$1")
	[[ "$value" =~ ^[0-9a-f]{64}$ ]] || { echo "bootstrap: $1 is not a SHA256 digest: $value" >&2; exit 1; }
	printf '%s' "$value"
}

sha256_of() {
	if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
	elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
	else echo "bootstrap: neither sha256sum nor shasum is available" >&2; exit 1
	fi
}

# Downloads url to file unless a verified copy is there, then verifies it.
fetch() {
	local url=$1 file=$2 expected=$3
	if [ ! -f "$file" ] || [ "$(sha256_of "$file")" != "$expected" ]; then
		echo "bootstrap: downloading $url"
		curl -fsSL --retry 3 --retry-max-time 30 "$url" -o "$file"
	fi
	local actual
	actual=$(sha256_of "$file")
	[ "$actual" = "$expected" ] || { echo "bootstrap: SHA256 mismatch for $file: expected $expected, got $actual" >&2; exit 1; }
}

pins_load

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
case "$OS" in darwin | linux) ;; *) echo "bootstrap: unsupported OS $OS" >&2; exit 1 ;; esac
case "$(uname -m)" in
arm64 | aarch64) ARCH=arm64 NODE_ARCH=arm64 ;;
x86_64 | amd64) ARCH=amd64 NODE_ARCH=x64 ;;
*) echo "bootstrap: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac

NODE_VERSION=$(pin NODE_VERSION)
TASK_VERSION=$(pin TASK_VERSION)
NODE_SHA256=$(digest "NODE_SHA256_${OS}_${ARCH}")
TASK_SHA256=$(digest "TASK_SHA256_${OS}_${ARCH}")

mkdir -p "$TOOLCHAIN_DIR" "$BIN_DIR" "$CACHE_DIR"

if [ "$("$TOOLCHAIN_DIR/bin/node" --version 2>/dev/null || true)" = "$NODE_VERSION" ]; then
	echo "bootstrap: Node $NODE_VERSION already installed"
else
	archive="node-$NODE_VERSION-$OS-$NODE_ARCH.tar.gz"
	fetch "https://nodejs.org/dist/$NODE_VERSION/$archive" "$CACHE_DIR/$archive" "$NODE_SHA256"
	rm -rf "${TOOLCHAIN_DIR:?}"/*
	tar -xzf "$CACHE_DIR/$archive" -C "$TOOLCHAIN_DIR" --strip-components=1
fi

if [ "$("$BIN_DIR/task" --version 2>/dev/null | awk 'NR==1 {print $NF}' || true)" = "${TASK_VERSION#v}" ]; then
	echo "bootstrap: Task $TASK_VERSION already installed"
else
	archive="task_${TASK_VERSION#v}_${OS}_${ARCH}.tar.gz"
	fetch "https://github.com/go-task/task/releases/download/$TASK_VERSION/task_${OS}_${ARCH}.tar.gz" \
		"$CACHE_DIR/$archive" "$TASK_SHA256"
	tar -xzf "$CACHE_DIR/$archive" -C "$BIN_DIR" task
fi

echo "bootstrap: running task install"
"$BIN_DIR/task" --dir "$REPO_ROOT" install

cat <<EOF

Bootstrap complete.
  Node: $TOOLCHAIN_DIR/bin/node
  Task: $BIN_DIR/task

Try: $BIN_DIR/task --list
EOF
