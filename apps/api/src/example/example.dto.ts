import { exampleRequestSchema } from '@robots/shared';
import { createZodDto } from 'nestjs-zod';

/** DTO строится из zod-схемы в `shared`: по нему валидирует глобальный pipe и строится Swagger. */
export class ExampleRequestDto extends createZodDto(exampleRequestSchema) {}
