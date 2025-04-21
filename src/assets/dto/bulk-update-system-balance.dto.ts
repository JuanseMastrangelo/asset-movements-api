import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { UpdateSystemBalanceDto } from './update-system-balance.dto';

export class BulkUpdateSystemBalanceDto {
  @IsArray({ message: 'Se requiere un array de balances para actualizar' })
  @ArrayMinSize(1, {
    message: 'Se requiere al menos un balance para actualizar',
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateSystemBalanceDto)
  balances: UpdateSystemBalanceDto[];
}
