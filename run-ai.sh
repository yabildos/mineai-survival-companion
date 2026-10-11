#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
data_dir="$project_dir/data"
pid_file="$data_dir/minecraft-agent.pid"
controller_file="$data_dir/controller.pid"
mcp_port="${MINECRAFT_AI_LISTEN_PORT:-25575}"

valid_port() {
  [[ "$1" =~ ^[0-9]+$ ]] && (( 10#$1 >= 1 && 10#$1 <= 65535 ))
}

stop_bot() {
  [[ -f "$pid_file" ]] || return 0
  local pid
  pid="$(<"$pid_file")"
  local command_line
  command_line="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  if [[ "$command_line" == *"src/server/host.ts"* ]] && kill -0 "$pid" 2>/dev/null; then
    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    for _ in {1..30}; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.2
    done
    kill -9 -- "-$pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
}

case "${1:-}" in
  status)
    if curl --silent --fail --max-time 2 "http://127.0.0.1:$mcp_port/health"; then exit 0; fi
    echo "MineAI не запущен (MCP :$mcp_port)."
    exit 1
    ;;
  stop)
    if [[ -f "$controller_file" ]]; then
      controller_pid="$(<"$controller_file")"
      if [[ "$controller_pid" != "$$" ]]; then
        kill -TERM "$controller_pid" 2>/dev/null || true
        for _ in {1..30}; do
          kill -0 "$controller_pid" 2>/dev/null || break
          sleep 0.2
        done
      fi
    fi
    stop_bot
    echo "MineAI остановлен."
    exit 0
    ;;
  restart)
    shift
    "$0" stop
    exec "$0" "$@"
    ;;
  help|-h|--help)
    printf 'Usage: %s [LAN-port] [task]\n       %s status|stop|restart\n' "$0" "$0"
    exit 0
    ;;
  --bot) lan_port="${2:-1234}" ;;
  *)
    lan_port="1234"
    session_goal="${MINECRAFT_AI_GOAL:-}"
    if [[ "${1:-}" =~ ^[0-9]+$ ]]; then
      lan_port="$1"
      shift
      session_goal="${MINECRAFT_AI_GOAL:-$*}"
    elif (($#)); then
      session_goal="$*"
    fi
    ;;
esac

if ! valid_port "$lan_port"; then
  echo "Неверный порт Minecraft: $lan_port" >&2
  exit 2
fi
if ! valid_port "$mcp_port"; then
  echo "Неверный MCP-порт: $mcp_port" >&2
  exit 2
fi

if [[ "${1:-}" == --bot ]]; then
  if [[ "${MINECRAFT_AI_IN_SHELL:-}" != 1 ]]; then
    exec nix --extra-experimental-features 'nix-command flakes' develop "$project_dir#ai" --command \
      env MINECRAFT_AI_IN_SHELL=1 "$0" --bot "$lan_port"
  fi
  if [[ ! -d "$project_dir/ai/engine/node_modules" ]]; then
    echo "Сначала установи зависимости: nix develop .#ai --command bun install --cwd ai/engine --frozen-lockfile --production" >&2
    exit 1
  fi
  minecraft_version="${MINECRAFT_AI_VERSION:-1.21.4}"
  if [[ ! "$minecraft_version" =~ ^[0-9]+(\.[0-9]+){1,2}$ ]]; then
    echo "Неверная версия Minecraft: $minecraft_version" >&2
    exit 2
  fi
  exec bwrap \
    --die-with-parent --new-session --unshare-ipc \
    --ro-bind /nix/store /nix/store --ro-bind /etc /etc \
    --proc /proc --dev /dev --tmpfs /tmp \
    --dir /workspace --bind "$project_dir" /workspace \
    --chdir /workspace/ai/engine --clearenv \
    --setenv HOME /workspace/data/home \
    --setenv PATH "$PATH" --setenv LANG "${LANG:-C.UTF-8}" \
    --setenv NODE_ENV production \
    "$(command -v bun)" src/server/host.ts \
      --minecraft-host "${MINECRAFT_AI_HOST:-127.0.0.1}" \
      --minecraft-port "$lan_port" \
      --username "${MINECRAFT_AI_BOT_NAME:-MineAI}" \
      --auth "${MINECRAFT_AI_AUTH:-offline}" \
      --version "$minecraft_version" \
      --listen-host 127.0.0.1 --listen-port "$mcp_port" \
      --instance-id minecraft --data-root /workspace/data/bot-data
fi

umask 077
mkdir -p "$data_dir"
echo "$$" >"$controller_file"
codex_pid=""
cleanup() {
  if [[ -n "$codex_pid" ]]; then kill -TERM "$codex_pid" 2>/dev/null || true; fi
  stop_bot
  rm -f "$controller_file"
}
trap cleanup EXIT
trap 'exit 0' INT TERM

if [[ -f "$pid_file" ]] && kill -0 "$(<"$pid_file")" 2>/dev/null; then
  echo "MineAI уже запущен на MCP :$mcp_port." >&2
  exit 1
fi
rm -f "$pid_file"
log_file="$data_dir/minecraft-agent.log"
setsid env MINECRAFT_AI_LISTEN_PORT="$mcp_port" \
  "$0" --bot "$lan_port" >"$log_file" 2>&1 &
bot_pid=$!
echo "$bot_pid" >"$pid_file"
echo "MineAI подключается к Minecraft :$lan_port; MCP :$mcp_port. Лог: $log_file"

ready=0
for _ in {1..120}; do
  if curl --silent --fail --max-time 1 "http://127.0.0.1:$mcp_port/health" >/dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$bot_pid" 2>/dev/null; then cat "$log_file" >&2; exit 1; fi
  sleep 0.5
done
if (( ! ready )); then
  echo "MineAI не поднял MCP за минуту. Проверь LAN-порт и $log_file." >&2
  exit 1
fi

if [[ "${MINECRAFT_AI_HOST_ONLY:-0}" == 1 ]]; then wait "$bot_pid"; exit $?; fi
if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI не найден. MCP работает на http://127.0.0.1:$mcp_port/mcp." >&2
  wait "$bot_pid"
  exit $?
fi
login_status="$(codex login status 2>&1)" || { echo "$login_status" >&2; exit 1; }
if [[ "$login_status" != *'Logged in using ChatGPT'* ]]; then
  echo "Войди в Codex через ChatGPT: codex login" >&2
  exit 1
fi

model="${MINECRAFT_AI_MODEL:-gpt-6-luna}"
prompt="${session_goal:-Будь универсальным survival-помощником рядом с игроком в этом мире. Сначала проверь состояние, инвентарь и безопасность. Выполняй текущие просьбы игрока; без просьб оставайся рядом и помогай по ситуации. Не предполагай старые цели, координаты или стадию игры. Действуй короткими безопасными шагами и проверяй результат каждого действия.}"
batch_seconds="${MINECRAFT_AI_CODEX_BATCH_SECONDS:-900}"
if [[ ! "$batch_seconds" =~ ^[0-9]+$ ]] || (( 10#$batch_seconds < 60 )); then
  echo "MINECRAFT_AI_CODEX_BATCH_SECONDS должен быть не меньше 60." >&2
  exit 2
fi

cd "$project_dir"
echo "MineAI готов. Codex управляет одним игроком; Ctrl+C завершит сессию."
while :; do
  set +e
  timeout --foreground "${batch_seconds}s" \
    env -u OPENAI_API_KEY -u CODEX_API_KEY -u OPENAI_BASE_URL \
      codex exec --strict-config -m "$model" -c 'model_provider="openai"' --color never \
      "Use the single configured minecraft MCP server. Read ai/playbook.md and only the relevant recipe from ai/skills.md. Refresh live status before acting, perform one safe bounded task at a time, then verify world/inventory state. Do not continue old goals without the user's request. Keep updates brief. $prompt" &
  codex_pid=$!
  wait "$codex_pid"
  codex_status=$?
  codex_pid=""
  set -e
  if (( codex_status != 0 && codex_status != 124 )); then
    echo "Codex завершился с кодом $codex_status; повтор через 5 секунд." >&2
    sleep 5
  fi
done
