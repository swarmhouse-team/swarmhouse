import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'argon2';
import { createHash } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

import { AuthService } from './auth.service';

const SECRET = 'test-secret';

let passwordHash: string;
let user: User;

beforeAll(async () => {
  passwordHash = await hash('correct-password');
  user = {
    id: 'user-1',
    email: 'dispatcher@swarmhouse.local',
    name: 'dispatcher',
    passwordHash,
  };
});

describe('AuthService', () => {
  let findUnique: ReturnType<typeof vi.fn>;
  let sessionCreate: ReturnType<typeof vi.fn>;
  let sessionFindUnique: ReturnType<typeof vi.fn>;
  let sessionDelete: ReturnType<typeof vi.fn>;
  let sessionDeleteMany: ReturnType<typeof vi.fn>;
  let service: AuthService;
  let jwt: JwtService;

  beforeEach(() => {
    findUnique = vi.fn();
    sessionCreate = vi
      .fn()
      .mockImplementation(({ data }) => Promise.resolve({ id: 'session-1', ...data }));
    sessionFindUnique = vi.fn();
    sessionDelete = vi.fn().mockResolvedValue({});
    sessionDeleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const prisma = {
      user: { findUnique },
      refreshSession: {
        create: sessionCreate,
        findUnique: sessionFindUnique,
        delete: sessionDelete,
        deleteMany: sessionDeleteMany,
      },
    } as unknown as PrismaService;

    jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn: '15m' } });
    service = new AuthService(prisma, jwt);
  });

  describe('login', () => {
    it('возвращает access и refresh токены, создаёт сессию с хешем, а не сырым токеном', async () => {
      findUnique.mockResolvedValue(user);

      const result = await service.login({ email: user.email, password: 'correct-password' });

      expect(jwt.verify(result.accessToken)).toMatchObject({
        sub: 'user-1',
        email: user.email,
      });
      expect(result.refreshToken).toMatch(/^session-1\..+$/);
      const storedHash = (sessionCreate.mock.calls[0] as [{ data: { tokenHash: string } }])[0].data
        .tokenHash;
      expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.refreshToken).not.toContain(storedHash);
    });

    it('неверный пароль → 401', async () => {
      findUnique.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessionCreate).not.toHaveBeenCalled();
    });

    it('неизвестный email → 401', async () => {
      findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@swarmhouse.local', password: 'any' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('валидный токен → старая сессия удаляется, выдаётся новая пара', async () => {
      const { createHash } = await import('node:crypto');
      const secret = 'raw-secret';
      sessionFindUnique.mockResolvedValue({
        id: 'session-1',
        tokenHash: createHash('sha256').update(secret).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...user },
      });

      const result = await service.refresh(`session-1.${secret}`);

      expect(sessionDelete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
      expect(result.refreshToken).toMatch(/^session-1\..+$/);
      expect(result.accessToken).toEqual(expect.any(String));
    });

    it('неверный secret → 401', async () => {
      sessionFindUnique.mockResolvedValue({
        id: 'session-1',
        tokenHash: 'other-hash',
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...user },
      });

      await expect(service.refresh('session-1.bad')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessionDelete).not.toHaveBeenCalled();
    });

    it('просроченная сессия → 401', async () => {
      sessionFindUnique.mockResolvedValue({
        id: 'session-1',
        tokenHash: 'x',
        expiresAt: new Date(Date.now() - 1000),
        user: { ...user },
      });

      await expect(service.refresh('session-1.any')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('без точки в токене → 401 без обращения к БД', async () => {
      await expect(service.refresh('garbage')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessionFindUnique).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('удаляет сессию, если секрет совпадает с хешем в БД', async () => {
      const secret = 'valid-secret';
      sessionFindUnique.mockResolvedValue({
        id: 'session-1',
        tokenHash: createHash('sha256').update(secret).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
        user,
      });

      await service.logout(`session-1.${secret}`);

      expect(sessionDelete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });

    it('не удаляет сессию по одному sessionId без верного секрета', async () => {
      sessionFindUnique.mockResolvedValue({
        id: 'session-1',
        tokenHash: createHash('sha256').update('real-secret').digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
        user,
      });

      await service.logout('session-1.forged-secret');

      expect(sessionDelete).not.toHaveBeenCalled();
      expect(sessionDeleteMany).not.toHaveBeenCalled();
    });

    it('без cookie молча ничего не делает', async () => {
      await service.logout(undefined);
      expect(sessionFindUnique).not.toHaveBeenCalled();
      expect(sessionDelete).not.toHaveBeenCalled();
    });
  });

  describe('verifyAccessToken', () => {
    it('валидный токен → payload', async () => {
      const token = await jwt.signAsync({ sub: 'user-1', email: user.email });
      await expect(service.verifyAccessToken(token)).resolves.toEqual({
        sub: 'user-1',
        email: user.email,
      });
    });

    it('поддельный токен → 401', async () => {
      const forged = new JwtService({ secret: 'other' }).sign({ sub: 'x', email: 'x' });
      await expect(service.verifyAccessToken(forged)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('me', () => {
    it('возвращает профиль без passwordHash', async () => {
      findUnique.mockResolvedValue(user);
      const profile = await service.me('user-1');
      expect(profile).toEqual({ id: 'user-1', email: user.email, name: user.name });
      expect(profile).not.toHaveProperty('passwordHash');
    });

    it('нет пользователя → 401', async () => {
      findUnique.mockResolvedValue(null);
      await expect(service.me('ghost')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
