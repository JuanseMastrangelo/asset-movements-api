import { Module } from '@nestjs/common';
import { TransactionRulesService } from './transaction-rules.service';
import { TransactionRulesController } from './transaction-rules.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TransactionRulesController],
  providers: [TransactionRulesService],
  exports: [TransactionRulesService],
})
export class TransactionRulesModule {}
