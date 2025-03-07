import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Servidor')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Validar estado del servidor',
    description: 'Comprueba que el servidor está en funcionamiento',
  })
  @ApiResponse({
    status: 200,
    description: 'Servidor funcionando correctamente',
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
