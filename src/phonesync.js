// Đồng bộ sang điện thoại qua Wi-Fi: máy tính mở một cổng tạm trong mạng nội bộ,
// điện thoại quét QR (hoặc nhập địa chỉ + mã) rồi tải bản dữ liệu giống file .nhacviec.json.
// Chỉ chạy khi cửa sổ "Đồng bộ sang điện thoại" đang mở, tự tắt sau 10 phút.
const http = require('http');
const os = require('os');
const crypto = require('crypto');

const PORT = 47800;            // cố định để tường lửa chỉ hỏi một lần; bận thì lấy cổng ngẫu nhiên
const TTL = 10 * 60 * 1000;

const newCode = () => String(crypto.randomInt(0, 1e6)).padStart(6, '0');

/** Các địa chỉ IPv4 trong mạng nội bộ của máy (Wi-Fi / LAN), ưu tiên 192.168.* */
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
      if (/vEthernet|VirtualBox|VMware|docker|br-|veth|utun|Hyper-V/i.test(name)) continue;
      out.push(a.address);
    }
  }
  const rank = ip => ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2;
  return out.sort((a, b) => rank(a) - rank(b));
}

function start({ code, getData, onPulled, ttl = TTL, port = PORT, host = '0.0.0.0' }) {
  let fails = 0;
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Headers': '*' }); return res.end(); }
    const m = req.url.match(/^\/nv\/(\d{6})(?:\?.*)?$/);
    if (!m) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<meta name="viewport" content="width=device-width"><body style="font:16px sans-serif;padding:24px">' +
        '<h2>Nhắc Việc</h2><p>Máy tính đang sẵn sàng gửi dữ liệu. Mở app <b>Nhắc Việc</b> trên điện thoại, bấm ⟳ rồi <b>Quét mã QR</b>.</p></body>');
    }
    if (fails >= 10) { res.writeHead(429); return res.end('{"error":"Nhập sai mã quá nhiều lần. Mở lại cửa sổ đồng bộ trên máy tính."}'); }
    if (m[1] !== code) {
      fails++;
      return setTimeout(() => { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end('{"error":"Sai mã đồng bộ"}'); }, 400);
    }
    const data = getData();
    // Mở link bằng trình duyệt thường (không phải app) thì hiện hướng dẫn thay vì JSON
    if ((req.headers.accept || '').includes('text/html') && !/[?&]app=1/.test(req.url)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<meta name="viewport" content="width=device-width"><body style="font:16px sans-serif;padding:24px"><h2>Nhắc Việc</h2>
        <p>Có ${data.tasks.length} việc sẵn sàng. Hãy quét mã này bằng nút <b>Quét mã QR</b> trong app Nhắc Việc, không dùng camera thường.</p></body>`);
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
    onPulled && onPulled({ count: data.tasks.length, from: req.socket.remoteAddress, at: new Date() });
  });

  return new Promise((resolve, reject) => {
    const ready = () => {
      const p = server.address().port;
      const ips = lanAddresses();
      const timer = setTimeout(() => stop(), ttl);
      const stop = () => { clearTimeout(timer); return new Promise(r => server.close(() => r())); };
      server.on('close', () => clearTimeout(timer));
      resolve({ port: p, ips, code, url: ips.length ? `http://${ips[0]}:${p}/nv/${code}` : null, stop, server, expiresAt: Date.now() + ttl });
    };
    server.once('error', e => {
      if (e.code === 'EADDRINUSE' && port !== 0) { server.listen(0, host, ready); } else reject(e);
    });
    server.listen(port, host, ready);
  });
}

module.exports = { start, lanAddresses, newCode, PORT };
