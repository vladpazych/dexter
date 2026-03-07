#!/bin/bash
input=$(cat)

# Parse metadata
MODEL_NAME=$(echo "$input" | jq -r '.model.display_name')
PROJECT_DIR=$(echo "$input" | jq -r '.workspace.project_dir')
SESSION_NAME=$(echo "$input" | jq -r '.session_name // empty')

# Extract model tier: Opus/Sonnet/Haiku
if echo "$MODEL_NAME" | grep -iq "opus"; then
  MODEL_DISPLAY="Opus"
elif echo "$MODEL_NAME" | grep -iq "sonnet"; then
  MODEL_DISPLAY="Sonnet"
elif echo "$MODEL_NAME" | grep -iq "haiku"; then
  MODEL_DISPLAY="Haiku"
else
  MODEL_DISPLAY="$MODEL_NAME"
fi

# Get project name and git branch
PROJECT_NAME=$(basename "$PROJECT_DIR")
GIT_BRANCH=$(cd "$PROJECT_DIR" && git -c gc.auto=0 rev-parse --abbrev-ref HEAD 2>/dev/null || echo "no-git")

# Build status line: Model  project  branch  |  topic (session name)
if [ -n "$SESSION_NAME" ]; then
  echo "$MODEL_DISPLAY  $PROJECT_NAME  $GIT_BRANCH  |  $SESSION_NAME"
else
  echo "$MODEL_DISPLAY  $PROJECT_NAME  $GIT_BRANCH"
fi
