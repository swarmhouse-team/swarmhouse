import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@robots/shared';

export const IS_PUBLIC_KEY = 'isPublic';

/** Помечает маршрут как публичный: глобальный AuthGuard его пропускает. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';

/** Ограничивает маршрут списком ролей. Проверяется глобальным AuthGuard после аутентификации. */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
