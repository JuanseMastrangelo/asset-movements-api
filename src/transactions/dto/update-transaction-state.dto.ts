import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TransactionState } from '@prisma/client';

export class UpdateTransactionStateDto {
  @ApiProperty({
    description: 'Nuevo estado de la transacción',
    enum: TransactionState,
    example: TransactionState.CURRENT_ACCOUNT,
  })
  @IsEnum(TransactionState)
  state: TransactionState;
}
