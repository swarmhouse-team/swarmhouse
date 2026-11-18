import type { Prisma, PrismaClient } from '../../../../generated/prisma/client';
import type { PrismaService } from '../../../../prisma/prisma.service';

/** Client methods shared by `PrismaClient` and an interactive transaction. */
export type PrismaDb = Prisma.TransactionClient;

type AssertAssignable<T extends Target, Target> = T;
type _PrismaClientIsDb = AssertAssignable<PrismaClient, PrismaDb>;
type _PrismaServiceIsDb = AssertAssignable<PrismaService, PrismaDb>;
