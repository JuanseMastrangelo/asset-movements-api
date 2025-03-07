import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TransactionDetailService } from './transaction-detail.service';
import { CreateTransactionDetailDto } from './dto/create-transaction-detail.dto';
import { UpdateTransactionDetailDto } from './dto/update-transaction-detail.dto';

@Controller('transaction-detail')
export class TransactionDetailController {
  constructor(private readonly transactionDetailService: TransactionDetailService) {}

  @Post()
  create(@Body() createTransactionDetailDto: CreateTransactionDetailDto) {
    return this.transactionDetailService.create(createTransactionDetailDto);
  }

  @Get()
  findAll() {
    return this.transactionDetailService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transactionDetailService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTransactionDetailDto: UpdateTransactionDetailDto) {
    return this.transactionDetailService.update(+id, updateTransactionDetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.transactionDetailService.remove(+id);
  }
}
