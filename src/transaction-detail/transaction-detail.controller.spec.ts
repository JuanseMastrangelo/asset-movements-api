import { Test, TestingModule } from '@nestjs/testing';
import { TransactionDetailController } from './transaction-detail.controller';
import { TransactionDetailService } from './transaction-detail.service';

describe('TransactionDetailController', () => {
  let controller: TransactionDetailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionDetailController],
      providers: [TransactionDetailService],
    }).compile();

    controller = module.get<TransactionDetailController>(TransactionDetailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
