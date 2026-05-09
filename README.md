# 同盟管理台

这是一个前后端一体部署的同盟管理系统：

- 后端：Express，入口在 backend/src/server.js
- 前端：静态页面，目录在 frontend
- 本地数据：快照存储在 backend/data/store.json
- Docker 生产数据：快照存储在 docker/data/store.json，不会被 git reset 覆盖

## 本地开发

1. 进入 backend 目录安装依赖
2. 执行 npm start
3. 浏览器打开 http://127.0.0.1:3100

默认账号密码：

- 账号：admin
- 密码：admin

如果你是较早一版 Docker 部署，docker/.env 里可能还是 ADMIN_PASSWORD=admin123456。
当前版本已经兼容这两种默认密码；建议后续统一把 docker/.env 改成 admin，避免口径不一致。

项目数据规则：

1. 同一个项目可以上传多次统计文件
2. 系统会把这些文件按时间串成一个项目时间线
3. 如果是新赛季，直接使用新的项目 ID，新赛季就当作新项目处理

异常数据处理：

1. 导入时系统会校验 CSV 表头、成员名、数字字段和有效成员数量
2. 校验失败会提示具体错误行，不会写入数据文件
3. 如果已经导入了异常统计，在看板的“上传记录和当前归档分布”表格中点击对应记录的“删除”
4. 删除某次统计后，看板、归档、趋势会按剩余统计重新计算

## Docker 一键部署

项目采用 docker 子目录管理部署文件：

- docker/Dockerfile
- docker/docker-compose.yml
- docker/.env.example
- docker/deploy.sh

首次部署：

1. 复制配置文件：cp docker/.env.example docker/.env
2. 修改 docker/.env 里的 ADMIN_PASSWORD 和 ADMIN_TOKEN
3. 执行：sh docker/deploy.sh up

部署完成后默认同时开放两个访问地址：

1. http://服务器IP:80
2. http://服务器IP:3100

其中 80 和 3100 都会转发到容器内的 3100 端口。

部署脚本会在服务器上强制执行以下动作：

1. git fetch origin
2. git reset --hard origin/main
3. git clean -fd
4. docker compose up -d --build

也就是说服务器代码会始终被重置到远端 main 分支最新版本。

如果你已经手动执行过 git pull，或者服务器上 git fetch 卡住，可以跳过脚本里的 Git 同步，只用当前代码重建：

```sh
DEPLOY_SKIP_GIT_SYNC=1 sh docker/deploy.sh rebuild
```

等价简写：

```sh
sh docker/deploy.sh rebuild-local
```

也可以把 docker/.env 里的 DEPLOY_SKIP_GIT_SYNC 改成 1，之后脚本就不会自动 git fetch/reset。

生产数据目录：

- Docker 会把 docker/data 挂载到容器内的 /app/backend/data
- docker/data/store.json 是正式运行数据文件
- docker/data 目录已被 Git 忽略，重新编译、重启、git reset 都不会覆盖它
- 不要手动删除 docker/data/store.json

如果你之前已经部署过旧版本，并且数据在 backend/data/store.json，第一次升级到当前版本前先在服务器执行：

```sh
cp backend/data/store.json /tmp/alliance-admin-store.json
git fetch origin
git reset --hard origin/main
mkdir -p docker/data
cp /tmp/alliance-admin-store.json docker/data/store.json
sh docker/deploy.sh rebuild-local
```

这一步只需要做一次。之后再执行 sh docker/deploy.sh rebuild，数据会继续保留在 docker/data/store.json。

## 腾讯云部署建议

适合直接部署到腾讯云 CVM。

1. 安装 Git、Docker、Docker Compose 插件
2. 在腾讯云安全组放行 80 端口
3. 如果要直接访问 3100，也要放行 3100 端口
4. 把项目代码上传到服务器
5. 在项目根目录执行 sh docker/deploy.sh up

如果需要 HTTPS，建议再用 Nginx 或腾讯云负载均衡做 443 反代。

如果服务器执行时提示没有权限访问 /var/run/docker.sock，脚本会自动改用 sudo docker。首次执行时按提示输入 sudo 密码即可。

## Git 初始化与上传

本地初始化仓库：

1. git init
2. git add .
3. git commit -m "chore: initial project import"

推送到远端仓库：

1. git remote add origin <你的仓库地址>
2. git branch -M main
3. git push -u origin main

## 常用部署命令

1. sh docker/deploy.sh up
2. sh docker/deploy.sh rebuild
3. sh docker/deploy.sh rebuild-fresh
4. sh docker/deploy.sh logs
5. sh docker/deploy.sh ps
6. sh docker/deploy.sh down
7. sh docker/deploy.sh clean