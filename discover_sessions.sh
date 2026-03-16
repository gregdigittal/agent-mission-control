#!/bin/bash
# discover_sessions.sh — Scans ~/.claude/projects/ to find Claude Code sessions
# Generates available_sessions.json for the Mission Control dashboard

CLAUDE_DIR="$HOME/.claude/projects"
OUTPUT="$(dirname "$0")/available_sessions.json"

echo "[" > "$OUTPUT"
first=true

for dir in "$CLAUDE_DIR"/*/; do
  [ -d "$dir" ] || continue
  projname=$(basename "$dir")

  # Count conversations
  convs=$(ls "$dir"*.jsonl 2>/dev/null | wc -l | tr -d ' ')
  [ "$convs" -eq 0 ] && continue

  # Skip root-level catches (just -Users, -Users-gregmorris with no project)
  segments=$(echo "$projname" | tr '-' '\n' | wc -l | tr -d ' ')
  [ "$segments" -lt 4 ] && continue

  # Extract a display name from the encoded path
  # Pattern: -Users-username-path-parts -> take everything after the username
  display=$(echo "$projname" \
    | sed 's/^-Users-[^-]*-//' \
    | sed 's/^Development-Projects-//' \
    | sed 's/-/ /g')

  # Get last modification time of newest .jsonl
  newest=$(ls -t "$dir"*.jsonl 2>/dev/null | head -1)
  modtime=""
  if [ -n "$newest" ]; then
    modtime=$(stat -f "%Sm" -t "%Y-%m-%dT%H:%M:%S" "$newest" 2>/dev/null)
  fi

  # Build the real filesystem path
  realpath=$(echo "$projname" | sed 's/-/\//g' | sed 's/^/\//')

  if [ "$first" = true ]; then
    first=false
  else
    echo "," >> "$OUTPUT"
  fi

  cat >> "$OUTPUT" << ENTRY
  {"id":"$projname","name":"$display","conversations":$convs,"lastActive":"$modtime","path":"$realpath"}
ENTRY
done

echo "" >> "$OUTPUT"
echo "]" >> "$OUTPUT"

echo "Wrote $(grep -c '"id"' "$OUTPUT") sessions to $OUTPUT"
