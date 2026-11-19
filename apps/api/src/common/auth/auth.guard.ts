import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { AccessPayload } from '../../auth/auth.service';

import { AuthService } from '../../auth/auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

/** Глобальный guard: требует валидный access JWT в `Authorization: Bearer`, кроме `@Public()`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) {
      throw new UnauthorizedException('Требуется авторизация');
    }

    const payload = await this.authService.verifyAccessToken(token);
    (request as Request & { user?: AccessPayload }).user = payload;
    return true;
  }
}
