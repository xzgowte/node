const http = require('http'); 
const net = require('net');
const { exec } = require('child_process');
const { WebSocket, createWebSocketStream } = require('ws');
const { TextDecoder } = require('util');

const uuid = (process.env.UUID || 'd342d11e-d424-4583-b36e-524ab1f0afa4').replace(/-/g, "");
const port = process.env.PORT || 3000;
const token = process.env.TOKEN || "eyJhIjoiZjRmZThjZTdiNDVlYjgzMTFmYWJhZDA5NDRkMTlkYzMiLCJ0IjoiYjY5MGQwNWMtZThlMS00YWNhLTg3ZTYtOTQyN2U0ZjlmYTE3IiwicyI6Ik9UQXpNekUzWWpjdE9EQmpOUzAwTWpFd0xXRXlOREl0TnpCbE1HUmpaV0ZqT1dZeSJ9";

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h1>Method Not Allowed</h1>
<p>The method is not allowed for the requested URL.</p>`);
});

server.listen(port, () => { 
    console.log(`HTTP server running at http://localhost:${port}/`);
    exec(`nohup ./cf tunnel run --token ${token} > /dev/null &`);
});

const wss = new WebSocket.Server({ server }); 

wss.on('connection', ws => {
    ws.once('message', msg => {
        const [VERSION] = msg;
        const id = msg.slice(1, 17);
        if (!id.every((v, i) => v == parseInt(uuid.substr(i * 2, 2), 16))) return;
        let i = msg.slice(17, 18).readUInt8() + 19;
        const port = msg.slice(i, i += 2).readUInt16BE(0);
        const ATYP = msg.slice(i, i += 1).readUInt8();
        const host = ATYP == 1 ? msg.slice(i, i += 4).join('.') :
            (ATYP == 2 ? new TextDecoder().decode(msg.slice(i + 1, i += 1 + msg.slice(i, i + 1).readUInt8())) :
                (ATYP == 3 ? msg.slice(i, i += 16).reduce((s, b, i, a) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), []).map(b => b.readUInt16BE(0).toString(16)).join(':') : ''));

        ws.send(new Uint8Array([VERSION, 0]));
        const duplex = createWebSocketStream(ws);
        net.connect({ host, port }, function () {
            this.write(msg.slice(i));
            duplex.on('error', () => {}).pipe(this).on('error', () => {}).pipe(duplex);
        }).on('error', () => {});
    }).on('error', () => {});
});



