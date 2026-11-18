import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginRequest, UserRole } from '@robots/shared';
import { verify } from 'argon2';
import { createHash, randomBytes } from 'node:crypto';

import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccessPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface SessionTokens {
  accessToken: string;
  /** Сырой refresh-токен `<sessionId>.<secret>`. В БД хранится только его sha256-хеш. */
  refreshToken: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /** Возвращает пользователя без `passwordHash` или `null`, если email/пароль неверны. */
  async validateUser(email: string, password: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && (await verify(user.passwordHash, password))) {
      const { passwordHash: _passwordHash, ...safeUser } = user;
      return safeUser;
    }
    return null;
  }

  /** Вход: при неверных данных бросает 401, при успехе возвращает access-токен и создаёт сессию. */
  async login(input: LoginRequest): Promise<SessionTokens> {
    const user = await this.validateUser(input.email, input.password);

    if (!user) {
      // Формат ошибки (`{ code, message }`) приводит ApiExceptionFilter.
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return this.issueSession(user);
  }

  /** Ротация: старая сессия удаляется, выдаётся новая пара токенов. */
  async refresh(rawToken: string): Promise<SessionTokens> {
    const session = await this.findActiveSession(rawToken);
    if (!session) {
      throw new UnauthorizedException('Сессия истекла или недействительна');
    }

    await this.prisma.refreshSession.delete({ where: { id: session.id } });
    return this.issueSession(session.user);
  }

  /** Отзыв сессии по refresh-токену (cookie). Если токена нет или он невалиден — молча выходим. */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }
    // Удаляем только после проверки секрета: по одному sessionId чужую сессию не отозвать.
    const session = await this.findActiveSession(rawToken);
    if (!session) {
      return;
    }
    await this.prisma.refreshSession.delete({ where: { id: session.id } });
  }

  /** Данные текущего пользователя по id из access-токена. */
  async me(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Проверка access-JWT. Используется и guardами HTTP, и WebSocket-шлюзом.
   * Бросает 401 при невалидном или просроченном токене.
   */
  async verifyAccessToken(token: string): Promise<AccessPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessPayload>(token);
      return { sub: payload.sub, email: payload.email, role: payload.role };
    } catch {
      throw new UnauthorizedException('Недействительный токен');
    }
  }

  private async issueSession(user: Omit<User, 'passwordHash'>): Promise<SessionTokens> {
    const secret = randomBytes(32).toString('base64url');
    const session = await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: sha256(secret),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { accessToken, refreshToken: `${session.id}.${secret}` };
  }

  /** Ищет сессию по id из токена, сверяет хеш и срок. */
  private async findActiveSession(rawToken: string) {
    const [sessionId, secret] = rawToken.split('.');
    if (!sessionId || !secret) {
      return null;
    }

    const session = await this.prisma.refreshSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    if (session.tokenHash !== sha256(secret)) {
      return null;
    }
    const { passwordHash: _passwordHash, ...user } = session.user;
    return { id: session.id, user };
  }
}
