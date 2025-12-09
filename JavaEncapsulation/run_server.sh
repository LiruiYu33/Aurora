#!/bin/bash

# 定义文件名和依赖
JAR_NAME="json-20240303.jar"
JAR_URL="https://repo1.maven.org/maven2/org/json/json/20240303/json-20240303.jar"

# 1. 检查并下载依赖库 (org.json)
if [ ! -f "$JAR_NAME" ]; then
    echo "正在下载依赖库 $JAR_NAME ..."
    curl -L -o "$JAR_NAME" "$JAR_URL"
    if [ $? -ne 0 ]; then
        echo "下载失败，请检查网络连接。"
        exit 1
    fi
    echo "下载完成。"
else
    echo "依赖库已存在。"
fi

# 2. 编译 Java 文件
echo "正在编译 SummarisePage.java ..."
javac -cp .:"$JAR_NAME" SummarisePage.java
if [ $? -ne 0 ]; then
    echo "编译失败！请检查代码错误。"
    exit 1
fi
echo "编译成功。"

# 3. 启动服务
echo "========================================"
echo "正在启动总结服务..."
echo "监听端口: 8080"
echo "请保持此终端窗口开启"
echo "========================================"

# 运行 Java 程序 (注意：Mac/Linux 使用 : 分隔 classpath)
java -cp .:"$JAR_NAME" SummarisePage 8080
