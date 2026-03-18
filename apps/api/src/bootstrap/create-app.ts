import 'dotenv/config';
import 'reflect-metadata';
import * as jwt from 'jsonwebtoken';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppExceptionFilter } from '../api/common/app-exception.filter';
import { AdminAnalyticsService } from '../api/admin/services/admin-analytics.service';
import type { RevenuePreset } from '../application/time/analytics-date';

const REVENUE_PRESETS: RevenuePreset[] = [
  'TODAY', 'THIS_MONTH', 'LAST_1_MONTH', 'LAST_3_MONTHS', 'LAST_6_MONTHS',
  'LAST_12_MONTHS', 'THIS_YEAR', 'LAST_YEAR', 'FY25', 'FY26', 'FY27',
];

/**
 * Creates and configures the Nest application (CORS, routes, pipes, filters).
 * Does not call listen() — use for Vercel serverless or from main.ts.
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const allowedOrigins = [
    'https://weyou-admin.onrender.com',
    /^https:\/\/.*\.vercel\.app$/,
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  ];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.some((o) => (typeof o === 'string' ? o === origin : o.test(origin)))) {
        return callback(null, true);
      }
      return callback(null, true); // fallback: allow (e.g. mobile, other hosts)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api');

  const adapter = app.getHttpAdapter();
  const rootPayload = {
    message: 'Weyou API',
    api: '/api',
    docs: 'Use /api as the base path for all endpoints (e.g. /api/auth/customer/otp/request)',
  };
  adapter.get('/', (_req: unknown, res: { status: (n: number) => { json: (o: object) => void } }) => {
    res.status(200).json(rootPayload);
  });
  adapter.get('/api', (_req: unknown, res: { status: (n: number) => { json: (o: object) => void } }) => {
    res.status(200).json(rootPayload);
  });
  adapter.get('/api/health', (_req: unknown, res: { status: (n: number) => { json: (o: object) => void } }) => {
    res.status(200).json({ ok: true, service: 'weyou-api', analytics: true });
  });
  adapter.get('/api/admin/analytics/_ping', (_req: unknown, res: { status: (n: number) => { json: (o: object) => void } }) => {
    res.status(200).json({ ok: true, message: 'analytics routes available' });
  });

  const secret = process.env.JWT_SECRET || 'dev-secret';
  const checkAuth = (req: { headers?: { authorization?: string } }): { ok: true } | { ok: false; status: number; body: object } => {
    const auth = req.headers?.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return { ok: false, status: 401, body: { error: { message: 'Missing Authorization header' } } };
    try {
      const payload = jwt.verify(auth.slice(7), secret) as { role: string };
      if (payload.role !== 'ADMIN' && payload.role !== 'BILLING') return { ok: false, status: 403, body: { error: { message: 'Forbidden' } } };
      return { ok: true };
    } catch {
      return { ok: false, status: 401, body: { error: { message: 'Invalid or expired token' } } };
    }
  };

  adapter.get('/api/admin/analytics/dashboard-kpis', async (req: unknown, res: { status: (n: number) => { json: (o: object) => void } }) => {
    const auth = checkAuth(req as { headers?: { authorization?: string } });
    if (!auth.ok) {
      const err = auth as { ok: false; status: number; body: object };
      res.status(err.status).json(err.body);
      return;
    }
    let service: AdminAnalyticsService;
    try {
      service = app.get(AdminAnalyticsService);
    } catch {
      res.status(503).json({ error: { message: 'Analytics service temporarily unavailable' } });
      return;
    }
    try {
      const data = await service.getDashboardKpis();
      res.status(200).json(data);
    } catch (e) {
      res.status(500).json({ error: { message: String(e) } });
    }
  });

  adapter.get('/api/admin/analytics/revenue', async (req: { query?: Record<string, unknown> } & unknown, res: { status: (n: number) => { json: (o: object) => void } }) => {
    const auth = checkAuth(req as { headers?: { authorization?: string } });
    if (!auth.ok) {
      const err = auth as { ok: false; status: number; body: object };
      res.status(err.status).json(err.body);
      return;
    }
    let service: AdminAnalyticsService;
    try {
      service = app.get(AdminAnalyticsService);
    } catch {
      res.status(503).json({ error: { message: 'Analytics service temporarily unavailable' } });
      return;
    }
    try {
      const q = (req as { query?: Record<string, unknown> }).query ?? {};
      const preset = (q.preset as string) && REVENUE_PRESETS.includes(q.preset as RevenuePreset) ? (q.preset as RevenuePreset) : undefined;
      const branchId = typeof q.branchId === 'string' ? q.branchId : undefined;
      const dateFrom = q.dateFrom ? new Date(q.dateFrom as string) : undefined;
      const dateTo = q.dateTo ? new Date(q.dateTo as string) : undefined;
      const data = await service.getRevenue({ preset, branchId, dateFrom, dateTo });
      res.status(200).json(data);
    } catch (e) {
      res.status(500).json({ error: { message: String(e) } });
    }
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AppExceptionFilter());

  return app;
}
