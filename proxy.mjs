/**
 * Proxy server: localhost:8888/api/* → localhost:9999/.netlify/functions/*
 * Mirrors netlify.toml redirects so local dev works without netlify dev.
 */
import http from 'http';

const FUNCTIONS_PORT = 9999;

const ROUTES = [
  // slots: preserve /api/doctors/:id/slots in forwarded path so the function can extract doctorId
  { from: /^\/api\/doctors\/(\d+)\/slots/, to: (m) => `/.netlify/functions/slots/api/doctors/${m[1]}/slots` },
  { from: /^\/api\/doctors\/(\d+)\/schedule/, to: '/.netlify/functions/schedules' },
  { from: /^\/api\/doctors\/(\d+)\/booking-fields/, to: (m) => `/.netlify/functions/booking-fields/api/doctors/${m[1]}/booking-fields` },
  { from: /^\/api\/doctors\/(\d+)/, to: '/.netlify/functions/doctors' },
  { from: /^\/api\/doctors/, to: '/.netlify/functions/doctors' },
  { from: /^\/api\/appointments\//, to: '/.netlify/functions/appointments' },
  { from: /^\/api\/appointments/, to: '/.netlify/functions/appointments' },
  { from: /^\/api\/specialties/, to: '/.netlify/functions/specialties' },
  { from: /^\/api\/health/, to: '/.netlify/functions/health' },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:8888`);

  let targetPath = null;
  for (const route of ROUTES) {
    const match = url.pathname.match(route.from);
    if (match) {
      targetPath = typeof route.to === 'function' ? route.to(match) : route.to;
      break;
    }
  }

  if (!targetPath) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Forward query params
  const target = `${targetPath}${url.search}`;

  // Collect request body
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    const options = {
      hostname: 'localhost',
      port: FUNCTIONS_PORT,
      path: target,
      method: req.method,
      headers: {
        ...req.headers,
        host: `localhost:${FUNCTIONS_PORT}`,
        'content-length': body.length,
      },
    };

    const proxyReq = http.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      console.error('Proxy error:', err.message);
      res.writeHead(502);
      res.end('Bad gateway');
    });

    if (body.length > 0) proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(8888, () => {
  console.log('MedBook proxy: http://localhost:8888 → http://localhost:9999/.netlify/functions/');
});
