#!/usr/bin/env sh

set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"
ENV_FILE="$DOCKER_DIR/.env"
DEFAULT_BRANCH="main"

if [ ! -f "$ENV_FILE" ]; then
  cp "$DOCKER_DIR/.env.example" "$ENV_FILE"
  echo "[init] 已生成 docker/.env，请检查配置后重试。"
  exit 0
fi

DEPLOY_BRANCH=$(grep '^DEPLOY_BRANCH=' "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d '=' -f 2-)
DEPLOY_BRANCH=${DEPLOY_BRANCH:-$DEFAULT_BRANCH}

echo "pull latest code..."
cd "$ROOT_DIR"
git fetch origin
git reset --hard "origin/$DEPLOY_BRANCH"
git clean -fd
echo "code synced: origin/$DEPLOY_BRANCH"

cmd="${1:-up}"

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi
  echo ""
}

COMPOSE="$(compose_cmd)"

if [ -z "$COMPOSE" ]; then
  echo "[error] 未找到 docker compose / docker-compose，请先安装。"
  exit 1
fi

cd "$DOCKER_DIR"

case "$cmd" in
  up)
    $COMPOSE --env-file .env up -d --build
    ;;
  rebuild)
    echo "[rebuild] 停止容器..."
    $COMPOSE --env-file .env down
    echo "[rebuild] 清理悬空镜像..."
    docker image prune -f
    echo "[rebuild] 重新构建镜像..."
    $COMPOSE --env-file .env build
    echo "[rebuild] 启动服务..."
    $COMPOSE --env-file .env up -d
    ;;
  rebuild-fresh)
    echo "[rebuild-fresh] 停止容器..."
    $COMPOSE --env-file .env down
    echo "[rebuild-fresh] 清理所有未使用镜像..."
    docker image prune -a -f
    echo "[rebuild-fresh] 全新构建..."
    $COMPOSE --env-file .env build --pull --no-cache
    echo "[rebuild-fresh] 启动服务..."
    $COMPOSE --env-file .env up -d
    ;;
  down)
    $COMPOSE --env-file .env down
    ;;
  restart)
    $COMPOSE --env-file .env down
    $COMPOSE --env-file .env up -d --build
    ;;
  logs)
    $COMPOSE --env-file .env logs -f --tail=200
    ;;
  ps)
    $COMPOSE --env-file .env ps
    ;;
  clean)
    docker system prune -f
    ;;
  clean-all)
    echo "[clean-all] ⚠️  将清理所有未使用的 Docker 资源..."
    printf '确认执行? (y/N): '
    read confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
      docker system prune -a -f --volumes
    else
      echo "[clean-all] 取消操作"
    fi
    ;;
  *)
    echo "Usage: sh docker/deploy.sh {up|rebuild|rebuild-fresh|down|restart|logs|ps|clean|clean-all}"
    exit 1
    ;;
esac