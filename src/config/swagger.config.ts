import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export class SwaggerConfig {
  static setup(app: INestApplication): void {
    const configV1 = new DocumentBuilder()
      .setTitle('API DE CASA DE CAMBIO')
      .setDescription('API para la casa de cambio')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const documentV1 = SwaggerModule.createDocument(app, configV1);

    SwaggerModule.setup('api/docs', app, documentV1, {
      swaggerOptions: {
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        tags: [
          { name: 'Servidor', description: 'Endpoints del servidor' },
          { name: 'Auth', description: 'Autenticación' },
          { name: 'Dashboard', description: 'Tablero principal' },
          { name: 'Transactions', description: 'Gestión de transacciones' },
          { name: 'Clients', description: 'Gestión de clientes' },
          { name: 'Users', description: 'Gestión de usuarios' },
          { name: 'Assets', description: 'Gestión de activos' },
        ],
      },
      explorer: true,
      customSiteTitle: 'API Casa de Cambio',
    });
  }
}
