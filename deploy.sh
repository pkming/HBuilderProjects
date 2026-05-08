#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "docker 未安装，请先在服务器安装 Docker。" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose 不可用，请先安装 Docker Compose 插件。" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "已生成 .env，请先修改账号密码和端口后重新执行。"
  exit 0
fi

docker compose pull --ignore-buildable || true
docker compose up -d --build
docker compose ps

echo
echo "部署完成。默认访问地址: http://服务器公网IP:${HOST_PORT:-80}"
