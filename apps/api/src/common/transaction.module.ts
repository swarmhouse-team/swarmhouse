import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { Transaction } from './application/transaction';
import { NestjsLogger, provideLogger } from './infrastructure/nestjs-logger';
import { PrismaTransaction } from './infrastructure/prisma-transaction';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    provideLogger('Transaction'),
    {
      provide: PrismaTransaction,
      inject: [PrismaService, NestjsLogger],
      useFactory: (prisma: PrismaService, logger: NestjsLogger) =>
        new PrismaTransaction(prisma, logger),
    },
    { provide: Transaction, useExisting: PrismaTransaction },
  ],
  exports: [Transaction, PrismaTransaction],
})
export class TransactionModule {}
