const http = require('http'); 
const net = require('net');
const fs = require("fs");
const axios = require("axios");
const { exec } = require('child_process');
const { WebSocket, createWebSocketStream } = require('ws');
const { TextDecoder } = require('util');
const dns = require('dns');
const path = require("path");

const uuid = (process.env.UUID || 'd342d11e-d424-4583-b36e-524ab1f0afa4').replace(/-/g, "");
const port = process.env.PORT || 3000;
const token = process.env.TOKEN || "";
const cfd = process.env.CFD === 'true';
const fileUrl = "https://github.com/malanto/test/raw/refs/heads/main/server";
const fileName = "server";
const filePath = path.join(__dirname, fileName);

async function downloadFile(fileUrl, fileName) {
  const writer = fs.createWriteStream(filePath);

  try {
    const response = await axios({
      method: "get",
      url: fileUrl,
      responseType: "stream",
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log(`✅ success：${fileName}`);
        resolve();
      });
      writer.on("error", reject);
    });
  } catch (err) {
    console.error("❌ err：", err.message);
  }
}

dns.setServers(['8.8.8.8', '8.8.4.4']);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<p>Service started successfully!</p>`);
});

server.listen(port, async () => { 
  console.log(`HTTP server running at http://localhost:${port}/`);

  if (cfd) {
    await downloadFile(fileUrl, fileName);

    fs.chmod(filePath, 0o755, (err) => {
      if (err) {
        console.error("❌ err：", err);
      } else {
        console.log("✅ success...");
        exec(`nohup ${filePath} tunnel run --token ${token} > /dev/null &`);
      }
    });
  }
});


const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    ws.once('message', async msg => {
        let socket;
        let cleaned = false;
        
        function cleanup() {
            if (cleaned) return;
            cleaned = true;
            
            if (socket && !socket.destroyed) {
                socket.destroy();
            }
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        }
        
        try {
            const [VERSION] = msg;
            const id = msg.slice(1, 17);
            
            if (!id.every((v, i) => v == parseInt(uuid.substr(i * 2, 2), 16))) {
                cleanup();
                return;
            }
            
            let i = msg.slice(17, 18).readUInt8() + 19;
            const targetPort = msg.slice(i, i += 2).readUInt16BE(0);
            const ATYP = msg.slice(i, i += 1).readUInt8();
            
            let host;
            if (ATYP == 1) {
                host = msg.slice(i, i += 4).join('.');
            } else if (ATYP == 2) {
                const domainLen = msg.slice(i, i + 1).readUInt8();
                host = new TextDecoder().decode(msg.slice(i + 1, i += 1 + domainLen));
            } else if (ATYP == 3) {
                host = msg.slice(i, i += 16)
                    .reduce((s, b, idx, a) => (idx % 2 ? s.concat(a.slice(idx - 1, idx + 1)) : s), [])
                    .map(b => b.readUInt16BE(0).toString(16))
                    .join(':');
            } else {
                cleanup();
                return;
            }
            
            let resolvedHost = host;
            if (ATYP == 2) {
                try {
                    const addresses = await dns.promises.resolve4(host);
                    resolvedHost = addresses[0];
                } catch (err) {
                    cleanup();
                    return;
                }
            }
            
            ws.send(new Uint8Array([VERSION, 0]));
            const duplex = createWebSocketStream(ws);
            
            socket = net.connect({ host: resolvedHost, port: targetPort }, function() {
                this.write(msg.slice(i));
                duplex.pipe(this);
                this.pipe(duplex);
            });
            
            socket.on('error', cleanup);
            duplex.on('error', cleanup);
            ws.on('close', cleanup);
            socket.on('close', cleanup);
            
        } catch (err) {
            cleanup();
        }
    });
    
    ws.on('error', () => {});
});
