import { Module } from '@nestjs/common';
import { DenominationsService } from './denominations.service';
import { DenominationsController } from './denominations.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DenominationsController],
  providers: [DenominationsService],
  exports: [DenominationsService],
})
export class DenominationsModule {}
