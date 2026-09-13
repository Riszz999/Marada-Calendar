import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { assertConnection } from './db.js';
import { ensureSchema } from './bootstrap.js';
import { isProduction, trustProxySetting, validateConfig } from './config.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { staffKeyRouter } from './routes/staffKey.js';
import { reservationsRouter } from './routes/reservations.js';
import { bookingRequestsRouter,adminBookingRequestsRouter } from './routes/bookingRequests.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
// ค่าเริ่มต้นผูกกับ loopback เท่านั้น — บน production ต้องให้ nginx เป็นทางเข้าเดียว
// ถ้าฟังทุก interface คนภายนอกยิงตรงพอร์ตนี้ข้าม nginx แล้วปลอม X-Forwarded-For ได้
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';

// production: เชื่อ proxy ชั้นเดียว (nginx) / development: ไม่เชื่อ X-Forwarded-For เลย
// ดูคำอธิบายข้อจำกัดใน config.js — ขอบเขตจริงคือต้องมีแต่ nginx ที่ต่อพอร์ตนี้ได้
app.set('trust proxy', trustProxySetting());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // 'unsafe-inline' จำเป็นเฉพาะ style เพราะ Google Fonts แทรก stylesheet เข้ามา
      // ส่วน style={{...}} ใน JSX ไม่ต้องพึ่งข้อนี้ (React เขียนผ่าน CSSOM ซึ่ง CSP ไม่บล็อก)
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      // script ต้องรัดแน่นที่สุด เพราะ JWT เก็บใน localStorage
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      ...(isProduction() ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  // HSTS ให้ nginx เป็นคนใส่ (มันคือชั้นที่พูด TLS จริง)
  hsts: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/admin/users', usersRouter);
app.use('/api/admin/staff-key', staffKeyRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/booking-requests', bookingRequestsRouter);
app.use('/api/admin/booking-requests', adminBookingRequestsRouter);

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

// eslint-disable-next-line no-unused-vars -- express ต้องเห็น 4 พารามิเตอร์จึงจะรู้ว่าเป็น error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

Promise.resolve()
  .then(validateConfig)
  .then(assertConnection)
  .then(ensureSchema)
  .then(() => {
    app.listen(PORT, BIND_HOST, () =>
      console.log(`API listening on http://${BIND_HOST}:${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`)
    );
  })
  .catch((err) => {
    console.error('เริ่ม server ไม่สำเร็จ:');
    console.error(err.message);
    process.exit(1);
  });
