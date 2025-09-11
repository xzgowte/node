# 检查 cloudflared 是否存在，不存在则下载
if [ ! -f ./cf ]; then
    echo "cf 文件不存在，正在下载..."
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cf
fi
# 启动 cloudflared 并写入日志
npm start
echo -e "启动成功"
