import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { AssetsModule } from './assets/assets.module';
import { TransactionsModule } from './transactions/transactions.module';
import { TransactionDetailModule } from './transaction-detail/transaction-detail.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TransactionRulesModule } from './transaction-rules/transaction-rules.module';
import { LogisticsModule } from './logistics/logistics.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UsersModule,
    AuthModule,
    ClientsModule,
    AssetsModule,
    TransactionsModule,
    TransactionDetailModule,
    DashboardModule,
    TransactionRulesModule,
    LogisticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
