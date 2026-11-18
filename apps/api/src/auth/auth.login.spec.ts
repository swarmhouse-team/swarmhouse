import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { httpProviders } from '../common/http/http.providers';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

import { AuthController } from './auth.controller';
import { AuthGuard } from '../common/auth/auth.guard';
import { AuthService } from './auth.service';

const PASSWORD = '123456';
const USER: User = {
  id: 'user-1',
  email: 'dispatcher@swarmhouse.local',
  name: 'dispatcher',
  passwordHash: '',
};

describe('Аутентификация: HTTP', () => {
  let app: INestApplication;
  let refreshCookie: string;
  let accessToken: string;

  beforeAll(async () => {
    USER.passwordHash = await hash(PASSWORD);

    // В памяти: пользователь и сессии с sha256-хешем.
    const sessions = new Map<
      string,
      { id: string; userId: string; tokenHash: string; expiresAt: Date }
    >();
    const prismaMock = {
      user: {
        findUnique: ({ where }: { where: { email?: string; id?: string } }) =>
          Promise.resolve(where.email === USER.email || where.id === USER.id ? USER : null),
      },
      refreshSession: {
        create: ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
          const id = `session-${sessions.size + 1}`;
          const row = { id, ...data };
          sessions.set(id, row);
          return Promise.resolve(row);
        },
        findUnique: ({ where }: { where: { id: string } }) =>
          Promise.resolve(
            sessions.has(where.id) ? { ...sessions.get(where.id), user: USER } : null,
          ),
        delete: ({ where }: { where: { id: string } }) => {
          sessions.delete(where.id);
          return Promise.resolve({});
        },
        deleteMany: ({ where }: { where: { id: string } }) => {
          sessions.delete(where.id);
          return Promise.resolve({ count: 1 });
        },
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_ACCESS_SECRET: 'test-secret', JWT_ACCESS_TTL: '15m' })],
        }),
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
      ],
      controllers: [AuthController],
      providers: [
        ...httpProviders,
        AuthService,
        Reflector,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('login: 200, accessToken в теле, refresh в httpOnly cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: USER.email, password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accessToken: expect.any(String) });
    expect(response.body).not.toHaveProperty('refreshToken');

    const cookie = String(response.headers['set-cookie']?.[0]);
    expect(cookie).toMatch(/^refresh_token=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/auth/);

    accessToken = response.body.accessToken;
    refreshCookie = cookie.split(';')[0] ?? '';
  });

  it('login: неверный пароль → 401 в формате ApiError', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: USER.email, password: 'wrong' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Неверный email или пароль',
    });
  });

  it('login: невалидный email → 400 VALIDATION_ERROR', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('me: без токена → 401 (глобальный guard)', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('me: с access-токеном → 200 и профиль', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: USER.id,
      email: USER.email,
      name: USER.name,
    });
  });

  it('refresh: по cookie → новая пара токенов, старая cookie не работает (ротация)', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(first.status).toBe(200);
    expect(first.body).toEqual({ accessToken: expect.any(String) });
    const rotated = String(first.headers['set-cookie']?.[0]).split(';')[0] ?? '';
    expect(rotated).not.toEqual(refreshCookie);

    const reuse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);
    expect(reuse.status).toBe(401);

    refreshCookie = rotated;
  });

  it('refresh: без cookie → 401', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/refresh');
    expect(response.status).toBe(401);
  });

  it('logout: 204 и cookie очищена; после этого refresh не работает', async () => {
    const logout = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', refreshCookie);

    expect(logout.status).toBe(204);
    expect(String(logout.headers['set-cookie']?.[0])).toMatch(/refresh_token=;/);

    const after = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);
    expect(after.status).toBe(401);
  });
});
