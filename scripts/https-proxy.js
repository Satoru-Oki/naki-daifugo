/**
 * ローカル開発用 HTTPS リバースプロキシ
 *
 * HTTP で動く Next.js (3000) と Express/Socket.io (3001) の前に
 * 1つの HTTPS サーバー (3443) を置く。
 *
 * スマホからは https://192.168.40.136:3443 にアクセスするだけ。
 * /socket.io/* → port 3001、それ以外 → port 3000 にルーティング。
 */
const https = require("https");
const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");

const certDir = path.join(__dirname, "..", "certs");
const key = fs.readFileSync(path.join(certDir, "key.pem"));
const cert = fs.readFileSync(path.join(certDir, "cert.pem"));

const PROXY_PORT = 3443;
const NEXT_PORT = 3000;
const API_PORT = 3001;

function targetPort(url) {
  return url && url.startsWith("/socket.io") ? API_PORT : NEXT_PORT;
}

// --- HTTP リクエストのプロキシ ---
const server = https.createServer({ key, cert }, (req, res) => {
  const port = targetPort(req.url);
  const proxyReq = http.request(
    {
      hostname: "localhost",
      port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `localhost:${port}` },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", () => {
    res.writeHead(502);
    res.end("Bad Gateway");
  });
  req.pipe(proxyReq);
});

// --- WebSocket upgrade のプロキシ ---
server.on("upgrade", (req, socket, head) => {
  const port = targetPort(req.url);

  const proxySocket = net.connect(port, "localhost", () => {
    // 元のHTTPアップグレードリクエストをそのまま転送
    const reqLine = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    const headers = Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    proxySocket.write(reqLine + headers + "\r\n\r\n");
    if (head && head.length) proxySocket.write(head);

    // 双方向パイプ
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxySocket.on("error", () => socket.end());
  socket.on("error", () => proxySocket.end());
});

server.listen(PROXY_PORT, () => {
  console.log(`🔒 HTTPS proxy: https://localhost:${PROXY_PORT}`);
  console.log(`   スマホ: https://192.168.40.136:${PROXY_PORT}`);
  console.log(`   /socket.io/* → localhost:${API_PORT}`);
  console.log(`   その他     → localhost:${NEXT_PORT}`);
});
