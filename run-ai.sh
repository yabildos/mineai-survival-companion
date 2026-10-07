#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == --bot ]]; then
  lan_port="${2:-1234}"
  session_goal=""
elif [[ "${1:-}" =~ ^[0-9]+$ ]]; then
  lan_port="$1"
  session_goal="${MINECRAFT_AI_GOAL:-${*:2}}"
else
  lan_port="1234"
  session_goal="${MINECRAFT_AI_GOAL:-$*}"
fi
if [[ ! "$lan_port" =~ ^[0-9]+$ ]] || (( 10#$lan_port < 1 || 10#$lan_port > 65535 )); then
  echo 'Неверный порт мира. По умолчанию используется 1234.' >&2
  exit 2
fi

if [[ "${1:-}" == --bot ]]; then
  if [[ "${MINECRAFT_AI_IN_SHELL:-}" != 1 ]]; then
    exec nix --extra-experimental-features 'nix-command flakes' develop "path:$project_dir#ai" --command \
      env MINECRAFT_AI_IN_SHELL=1 "$0" --bot "$lan_port"
  fi
  bot_name="${MINECRAFT_AI_BOT_NAME:-MineAI}"
  if [[ ! "$bot_name" =~ ^[A-Za-z0-9_]{3,16}$ ]]; then
    echo 'Имя бота должно содержать 3–16 латинских букв, цифр или _.' >&2
    exit 2
  fi
  if [[ ! -d "$project_dir/ai/engine/node_modules" ]]; then
    echo 'Зависимости бота не установлены: nix develop .#ai --command bun install --cwd ai/engine --frozen-lockfile --production' >&2
    exit 1
  fi
  minecraft_version="${MINECRAFT_AI_VERSION:-1.21.4}"
  if [[ ! "$minecraft_version" =~ ^[0-9]+(\.[0-9]+){1,2}$ ]]; then
    echo 'MINECRAFT_AI_VERSION должен выглядеть как 1.21.4.' >&2
    exit 2
  fi
  echo "MineAI подключается как Minecraft $minecraft_version к 127.0.0.1:$lan_port"
  cd "$project_dir/ai/engine"
  exec bwrap \
    --die-with-parent --new-session --unshare-ipc \
    --ro-bind /nix/store /nix/store --ro-bind /etc /etc \
    --proc /proc --dev /dev --tmpfs /tmp \
    --dir /home --dir /home/admin --dir /home/admin/projects \
    --bind "$project_dir" "$project_dir" \
    --chdir "$project_dir/ai/engine" --clearenv \
    --setenv HOME "$project_dir/data/home" \
    --setenv PATH "$PATH" --setenv LANG "${LANG:-C.UTF-8}" \
    --setenv NODE_ENV production \
    "$(command -v bun)" src/server/host.ts \
      --minecraft-host 127.0.0.1 --minecraft-port "$lan_port" \
      --username "$bot_name" --auth offline --version "$minecraft_version" \
      --listen-host 127.0.0.1 --listen-port 25575 \
      --data-root "$project_dir/data/bot-data"
fi

if ! command -v codex >/dev/null 2>&1; then
  echo 'Codex CLI не найден в PATH.' >&2
  exit 1
fi
login_status="$(codex login status 2>&1)" || { echo "$login_status" >&2; exit 1; }
if [[ "$login_status" != *'Logged in using ChatGPT'* ]]; then
  echo 'Нужен вход через ChatGPT. API-ключ не используется.' >&2
  exit 1
fi
model="${MINECRAFT_AI_MODEL:-gpt-6-luna}"
case "$model" in
  gpt-6-luna|gpt-6.1-sol) ;;
  *) echo 'MINECRAFT_AI_MODEL: поддерживаются gpt-6-luna и gpt-6.1-sol.' >&2; exit 2 ;;
esac
if curl --silent --fail --max-time 2 --output /dev/null http://127.0.0.1:25575/health; then
  echo 'MineAI уже запущен на порту 25575. Останови прежний сеанс.' >&2
  exit 1
fi

umask 077
mkdir -p "$project_dir/data/home" "$project_dir/data/bot-data"
bot_log="$project_dir/data/bot.log"
if [[ -z "$session_goal" ]]; then
  session_goal='будь универсальным survival-помощником рядом с игроком: защищай, носи ресурсы, добывай нужное, строй простые вещи, восстанавливайся после смерти и выполняй просьбы пользователя; не продолжай старые цели без прямой просьбы'
fi
setsid "$0" --bot "$lan_port" >"$bot_log" 2>&1 &
bot_pid=$!
cleanup() {
  kill -- "-$bot_pid" 2>/dev/null || true
  wait "$bot_pid" 2>/dev/null || true
}
trap cleanup EXIT

echo "Подключаю MineAI к миру. Лог: $bot_log"
for ((attempt = 0; attempt < 120; attempt++)); do
  if curl --silent --fail --max-time 1 --output /dev/null http://127.0.0.1:25575/health; then
    cd "$project_dir"
    env -u OPENAI_API_KEY -u CODEX_API_KEY -u OPENAI_BASE_URL \
      MINECRAFT_AI_GOAL="$session_goal" \
      codex --strict-config -m "$model" -c 'model_provider="openai"' \
      "MineAI goal: $session_goal"
    exit $?
  fi
  if ! kill -0 "$bot_pid" 2>/dev/null; then
    echo "MineAI завершился. Проверь лог: $bot_log" >&2
    exit 1
  fi
  if rg -q "connect ECONNREFUSED 127.0.0.1:$lan_port" "$bot_log"; then
    echo "Мир не открыт для сети на порту $lan_port. Укажи порт 1234 в Minecraft." >&2
    exit 1
  fi
  sleep 0.5
done

echo "MineAI не подключился за минуту. Проверь порт мира и лог: $bot_log" >&2
exit 1
