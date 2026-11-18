#!/bin/sh
# Back up data and images from Firebase Storage to the local project.
# POSIX sh compatible (including iSH/BusyBox ash).

# Resolve this script's directory, even when invoked from another directory.
SCRIPT_DIR=$(CDPATH= cd -P "$(dirname "$0")" 2>/dev/null && pwd) || {
    echo "Error: unable to determine script directory" >&2
    exit 1
}
PROJECT_ROOT=$(CDPATH= cd -P "$SCRIPT_DIR/.." 2>/dev/null && pwd) || {
    echo "Error: unable to determine project root" >&2
    exit 1
}

cd "$PROJECT_ROOT" || exit 1

# Prefer Python 3, while allowing an explicit interpreter override.
if [ -n "${PYTHON:-}" ]; then
    PYTHON_CMD=$PYTHON
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD=python3
else
    PYTHON_CMD=python
fi

"$PYTHON_CMD" "$SCRIPT_DIR/backup.py" "$@"
status=$?

# Match backup.bat's 10-second pause for interactive terminal sessions.
sleep 10

exit "$status"
