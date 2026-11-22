#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE="${ROOT_DIR}/thm-markdown-copier.user.js"
RAW_URL="https://raw.githubusercontent.com/Salvatierra-Benjamin/try-copy-me-extention/main/thm-markdown-copier.user.js"

VERSION="$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "${ROOT_DIR}/manifest.json" | head -n 1)"
if [[ -z "${VERSION}" ]]; then
  echo "Error: could not read version from manifest.json" >&2
  exit 1
fi

{
  cat <<EOF
// ==UserScript==
// @name         THM Markdown Copier
// @namespace    https://github.com/Salvatierra-Benjamin/try-copy-me-extention
// @version      ${VERSION}
// @description  Copy an entire TryHackMe room to the clipboard as clean Markdown.
// @match        https://tryhackme.com/room/*
// @grant        none
// @run-at       document-idle
// @downloadURL  ${RAW_URL}
// @updateURL    ${RAW_URL}
// ==/UserScript==

// GENERATED FILE — edit converter.js or content.js and run ./scripts/build-userscript.sh.

EOF
  cat "${ROOT_DIR}/converter.js"
  printf "\n"
  cat "${ROOT_DIR}/content.js"
} > "${OUT_FILE}"

echo "Built ${OUT_FILE} (v${VERSION})"
