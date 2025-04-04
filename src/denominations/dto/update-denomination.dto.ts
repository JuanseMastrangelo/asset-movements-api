import { PartialType } from '@nestjs/swagger';
import { CreateDenominationDto } from './create-denomination.dto';

export class UpdateDenominationDto extends PartialType(CreateDenominationDto) {}
