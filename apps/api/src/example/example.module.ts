import { Module } from '@nestjs/common';

import { ExampleController } from './example.controller';

/** Образец эндпоинта с валидацией. Удалить, когда появится первая настоящая фича. */
@Module({
  controllers: [ExampleController],
})
export class ExampleModule {}
