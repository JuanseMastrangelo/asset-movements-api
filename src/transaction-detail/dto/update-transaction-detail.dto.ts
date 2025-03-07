import { PartialType } from '@nestjs/swagger';
import { CreateTransactionDetailDto } from './create-transaction-detail.dto';

export class UpdateTransactionDetailDto extends PartialType(CreateTransactionDetailDto) {}
