#!/usr/bin/env sh

set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"
ENV_FILE="$DOCKER_DIR/.env"
DATA_DIR="$DOCKER_DIR/data"
PERSIST_STORE_FILE="$DATA_DIR/store.json"
LEGACY_STORE_FILE="$ROOT_DIR/backend/data/store.json"
STORE_BACKUP_FILE="/tmp/alliance-admin-store-backup.json"
DEFAULT_BRANCH="main"
USE_SUDO="0"
COMPOSE_MODE=""

if [ ! -f "$ENV_FILE" ]; then
  cp "$DOCKER_DIR/.env.example" "$ENV_FILE"
  echo "[init] 已生成 docker/.env，请检查配置后重试。"
  exit 0
fi

mkdir -p "$DATA_DIR"
if [ ! -f "$PERSIST_STORE_FILE" ] && [ -f "$LEGACY_STORE_FILE" ]; then
  cp "$LEGACY_STORE_FILE" "$STORE_BACKUP_FILE"
  echo "[data] 已备份旧数据文件，稍后迁移到 docker/data/store.json。"
fi

DEPLOY_BRANCH=$(grep '^DEPLOY_BRANCH=' "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d '=' -f 2-)
DEPLOY_BRANCH=${DEPLOY_BRANCH:-$DEFAULT_BRANCH}

if ! command -v docker >/dev/null 2>&1; then
  echo "[error] 未找到 docker，请先安装。"
  exit 1
fi

if docker info >/dev/null 2>&1; then
  USE_SUDO="0"
elif command -v sudo >/dev/null 2>&1; then
  USE_SUDO="1"
  echo "[docker] 当前用户无 docker 权限，后续命令将自动使用 sudo。"
else
  echo "[error] 当前用户无 docker 权限，且系统未安装 sudo。"
  exit 1
fi

run_docker() {
  if [ "$USE_SUDO" = "1" ]; then
    sudo docker "$@"
  else
    docker "$@"
  fi
}

run_compose() {
  if [ "$COMPOSE_MODE" = "plugin" ]; then
    run_docker compose "$@"
  else
    if [ "$USE_SUDO" = "1" ]; then
      sudo docker-compose "$@"
    else
      docker-compose "$@"
    fi
  fi
}

echo "pull latest code..."
cd "$ROOT_DIR"
git fetch origin
git reset --hard "origin/$DEPLOY_BRANCH"
git clean -fd
mkdir -p "$DATA_DIR"
if [ ! -f "$PERSIST_STORE_FILE" ] && [ -f "$STORE_BACKUP_FILE" ]; then
  cp "$STORE_BACKUP_FILE" "$PERSIST_STORE_FILE"
  echo "[data] 已迁移运行数据到 docker/data/store.json，后续重新编译不会被 git reset 覆盖。"
fi
echo "code synced: origin/$DEPLOY_BRANCH"

cmd="${1:-up}"

compose_cmd() {
  if run_docker compose version >/dev/null 2>&1; then
    COMPOSE_MODE="plugin"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_MODE="standalone"
    return
  fi
  COMPOSE_MODE=""
}

compose_cmd

if [ -z "$COMPOSE_MODE" ]; then
  echo "[error] 未找到 docker compose / docker-compose，请先安装。"
  exit 1
fi

cd "$DOCKER_DIR"

case "$cmd" in
  up)
    run_compose --env-file .env up -d --build
    ;;
  rebuild)
    echo "[rebuild] 停止容器..."
    run_compose --env-file .env down
    echo "[rebuild] 清理悬空镜像..."
    run_docker image prune -f
    echo "[rebuild] 重新构建镜像..."
    run_compose --env-file .env build
    echo "[rebuild] 启动服务..."
    run_compose --env-file .env up -d
    ;;
  rebuild-fresh)
    echo "[rebuild-fresh] 停止容器..."
    run_compose --env-file .env down
    echo "[rebuild-fresh] 清理所有未使用镜像..."
    run_docker image prune -a -f
    echo "[rebuild-fresh] 全新构建..."
    run_compose --env-file .env build --pull --no-cache
    echo "[rebuild-fresh] 启动服务..."
    run_compose --env-file .env up -d
    ;;
  down)
    run_compose --env-file .env down
    ;;
  restart)
    run_compose --env-file .env down
    run_compose --env-file .env up -d --build
    ;;
  logs)
    run_compose --env-file .env logs -f --tail=200
    ;;
  ps)
    run_compose --env-file .env ps
    ;;
  clean)
    run_docker system prune -f
    ;;
  clean-all)
    echo "[clean-all] ⚠️  将清理所有未使用的 Docker 资源..."
    printf '确认执行? (y/N): '
    read confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
      run_docker system prune -a -f --volumes
    else
      echo "[clean-all] 取消操作"
    fi
    ;;
  *)
    echo "Usage: sh docker/deploy.sh {up|rebuild|rebuild-fresh|down|restart|logs|ps|clean|clean-all}"
    exit 1
    ;;
esac