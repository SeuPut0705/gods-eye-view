#!/bin/bash
# Double-click in Finder to start God's Eye View in your browser.
cd "$(dirname "$0")" || exit 1

# Finder-launched shells may miss Homebrew's bin directories.
for dir in /opt/homebrew/bin /usr/local/bin; do
  [ -x "$dir/node" ] && case ":$PATH:" in *":$dir:"*) ;; *) PATH="$dir:$PATH" ;; esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Install Node 24 LTS from https://nodejs.org/ and double-click this file again."
  open "https://nodejs.org/"
  read -r -p "Press Enter to close."
  exit 1
fi

node scripts/launch.mjs
status=$?
if [ "$status" -ne 0 ]; then
  read -r -p "Launch failed. Press Enter to close."
fi
exit "$status"
