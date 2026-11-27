import { Module } from '@nestjs/common';

import { provideLogger } from '../../common/infrastructure/nestjs-logger';
import { WarehouseRoomPublisher } from './warehouse-room.publisher';
import { WarehouseSubscriptionBook } from './warehouse-subscription.book';

@Module({
  providers: [
    provideLogger('WarehouseRealtime'),
    WarehouseSubscriptionBook,
    WarehouseRoomPublisher,
  ],
  exports: [WarehouseRoomPublisher, WarehouseSubscriptionBook],
})
export class WarehouseRealtimeModule {}
