import { Test, TestingModule } from '@nestjs/testing';
import { TransactionDetailService } from './transaction-detail.service';

describe('TransactionDetailService', () => {
  let service: TransactionDetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionDetailService],
    }).compile();

    service = module.get<TransactionDetailService>(TransactionDetailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
