#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

# jq filter to extract streaming text from assistant messages
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

# jq filter to extract final result
final_result='select(.type == "result").result // empty'

for ((i=1; i<=$1; i++)); do
  tmpfile=$(mktemp)
  trap "rm -f $tmpfile" EXIT

  claude --dangerously-skip-permissions \
    --verbose \
    --output-format stream-json \
    -p "@PRD.md @progress.txt \
  1. Find the highest-priority task and implement it. \
  2. Run your tests and type checks. \
  3. Update the PRD with what was done. \
  4. Append your progress to progress.txt. \
  5. Commit your changes. \
  ONLY WORK ON A SINGLE TASK. \
  If the PRD is complete, output <promise>COMPLETE</promise>.

  When choosing the next task, prioritize in this order: \
  1. Architectural decisions and core abstractions \
  2. Integration points between modules \
  3. Unknown unknowns and spike work \
  4. Standard features and implementation \
  5. Polish, cleanup, and quick wins \
  Fail fast on risky work. Save easy wins for later. \

  After completing each task, append to progress.txt: \
  - Task completed and PRD item reference \
  - Key decisions made and reasoning \
  - Files changed \
  - Any blockers or notes for next iteration \
  Keep entries concise. Sacrifice grammar for the sake of concision. This file helps future iterations skip exploration \
" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "PRD complete after $i iterations."
    exit 0
  fi
done