# 同盟管理台

这是一个前后端一体部署的同盟管理系统：

- 后端：Express，入口在 backend/src/server.js
- 前端：静态页面，目录在 frontend
- 数据：快照存储在 backend/data/store.json

## 本地开发

1. 进入 backend 目录安装依赖
2. 执行 npm start
3. 浏览器打开 http://127.0.0.1:3100

默认账号密码：

- 账号：admin
- 密码：admin

## Docker 一键部署

项目根目录已经提供：

- Dockerfile
- docker-compose.yml
- .env.example
- deploy.sh

首次部署：

1. 复制配置文件：cp .env.example .env
2. 修改 .env 里的 ADMIN_PASSWORD 和 ADMIN_TOKEN
3. 执行：bash deploy.sh

部署完成后默认通过 80 端口提供服务。

## 腾讯云部署建议

适合直接部署到腾讯云 CVM。

1. 安装 Git、Docker、Docker Compose 插件
2. 在腾讯云安全组放行 80 端口
3. 把项目代码上传到服务器
4. 在项目根目录执行 bash deploy.sh

如果需要 HTTPS，建议再用 Nginx 或腾讯云负载均衡做 443 反代。

## Git 初始化与上传

本地初始化仓库：

1. git init
2. git add .
3. git commit -m "chore: initial project import"

推送到远端仓库：

1. git remote add origin <你的仓库地址>
2. git branch -M main
3. git push -u origin main