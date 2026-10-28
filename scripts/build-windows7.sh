#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/cenac-win7-build.XXXXXX")"
cleanup() {
  if [[ -d "$build_dir/gopath" ]]; then
    chmod -R u+w "$build_dir/gopath"
  fi
  rm -r -- "$build_dir"
}
trap cleanup EXIT

for command_name in curl sha256sum tar unzip npm node; do
  command -v "$command_name" >/dev/null || {
    echo "Missing build tool: $command_name" >&2
    exit 1
  }
done

go_archive="$build_dir/go1.20.14.linux-amd64.tar.gz"
node_archive="$build_dir/node-v16.6.2-win-x86.zip"
curl -fsSL --retry 3 -o "$go_archive" https://go.dev/dl/go1.20.14.linux-amd64.tar.gz
curl -fsSL --retry 3 -o "$node_archive" https://nodejs.org/dist/v16.6.2/node-v16.6.2-win-x86.zip
printf '%s  %s\n' 'ff445e48af27f93f66bd949ae060d97991c83e11289009d311f25426258f9c44' "$go_archive" | sha256sum -c -
printf '%s  %s\n' 'b7324b70ed37e14878cde39cd69099368513068495b25d97f1423591c0206685' "$node_archive" | sha256sum -c -

mkdir -p "$build_dir/toolchain" "$build_dir/stage" "$build_dir/launcher" "$build_dir/bin"
tar -xzf "$go_archive" -C "$build_dir/toolchain"
go_bin="$build_dir/toolchain/go/bin/go"

cp "$project_dir/package.json" "$project_dir/package-lock.json" "$build_dir/stage/"
cp -a "$project_dir/src" "$project_dir/public" "$build_dir/stage/"
cp "$project_dir/geonames-full.db" "$build_dir/stage/"
unzip -j -q "$node_archive" '*/node.exe' -d "$build_dir/stage"
npm --prefix "$build_dir/stage" ci --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund

# Ship the exact Node-API x86 addon tested on Win7; never compile on the target.
sqlite_archive="$build_dir/sqlite3-v5.1.7-napi-v6-win32-ia32.tar.gz"
curl -fsSL --retry 3 -o "$sqlite_archive" \
  https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-win32-ia32.tar.gz
printf '%s  %s\n' '8cd346d2341f4dbda30a2b592656ea14290d86d70608585628256ba4e89153a3' "$sqlite_archive" | sha256sum -c -
tar -xzf "$sqlite_archive" -C "$build_dir/stage/node_modules/sqlite3" build/Release/node_sqlite3.node

expected_addon="$build_dir/stage/node_modules/sqlite3/build/Release/node_sqlite3.node"
test -s "$expected_addon"
if [[ -n "$(find "$build_dir/stage/node_modules" -type f \( -name '*.node' -o -name '*.so' \) ! -path "$expected_addon" -print -quit)" ]]; then
  echo 'The production dependencies contain unexpected native modules.' >&2
  exit 1
fi

tar -czf "$build_dir/launcher/payload.tar.gz" \
  --exclude='node_modules/.bin' \
  -C "$build_dir/stage" node.exe src public node_modules package.json geonames-full.db
cp "$project_dir/scripts/windows32-launcher/main.go" "$build_dir/launcher/main.go"

GOBIN="$build_dir/bin" GOPATH="$build_dir/gopath" \
  "$go_bin" install github.com/tc-hib/go-winres@v0.3.3
"$build_dir/bin/go-winres" simply \
  --arch 386 \
  --icon "$project_dir/public/favicon.png" \
  --out "$build_dir/launcher/rsrc" \
  --file-description 'Cenac API' \
  --product-name 'Cenac API' \
  --original-filename 'cenac-api-win7-selfcontained.exe'
test -s "$build_dir/launcher/rsrc_windows_386.syso"

output="$project_dir/dist/cenac-api-win7-selfcontained.exe"
mkdir -p "$project_dir/dist"
(
  cd "$build_dir/launcher"
  GO111MODULE=off GOOS=windows GOARCH=386 \
    "$go_bin" build -trimpath -ldflags='-s -w' -o "$output" .
)

"$build_dir/bin/go-winres" extract --dir "$build_dir/verify" "$output" >/dev/null
node -e '
  const fs = require("fs");
  const path = require("path");
  const resourceFile = path.join(process.argv[1], "winres.json");
  const resources = JSON.parse(fs.readFileSync(resourceFile, "utf8"));
  if (!resources.RT_GROUP_ICON) throw new Error("Windows icon resource missing");
' "$build_dir/verify"

echo "Built $output"
sha256sum "$output"
