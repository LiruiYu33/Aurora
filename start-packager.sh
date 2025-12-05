#!/bin/bash

# 检查 Metro 是否已在运行
if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Metro bundler 已在运行在 8081 端口"
    exit 0
fi

echo "启动 Metro bundler..."
cd "$(dirname "$0")"
npm start &
PACKAGER_PID=$!
echo $PACKAGER_PID > .packager.pid

# 等待 Metro 启动
sleep 10

exit 0
