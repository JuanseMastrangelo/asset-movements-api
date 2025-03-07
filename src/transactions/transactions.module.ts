import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { TransactionDetailModule } from 'src/transaction-detail/transaction-detail.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [TransactionDetailModule, PrismaModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
