import { PartialType } from '@nestjs/swagger';
import { CreateLogisticsSettingsDto } from './create-logistics-settings.dto';

export class UpdateLogisticsSettingsDto extends PartialType(
  CreateLogisticsSettingsDto,
) {}
