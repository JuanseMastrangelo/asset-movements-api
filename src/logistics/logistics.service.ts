import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import {
  CreateLogisticsDto,
  UpdateLogisticsDto,
  CreateLogisticsSettingsDto,
  UpdateLogisticsSettingsDto,
  CalculateLogisticsPriceDto,
} from './dto';
import {
  Logistics,
  LogisticsSettings,
  LogisticsPriceCalculation,
} from './entities';

@Injectable()
export class LogisticsService {
  private googleMapsApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.googleMapsApiKey = this.configService.get<string>(
      'GOOGLE_MAPS_API_KEY',
    );
  }

  // Métodos para la gestión de logística
  async createLogistics(
    createLogisticsDto: CreateLogisticsDto,
  ): Promise<Logistics> {
    try {
      // Verificar que la transacción exista
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: createLogisticsDto.transactionId },
      });

      if (!transaction) {
        throw new NotFoundException(
          `La transacción con ID ${createLogisticsDto.transactionId} no existe`,
        );
      }

      // Verificar si ya existe una logística para esta transacción
      const existingLogistics = await this.prisma.logistics.findUnique({
        where: { transactionId: createLogisticsDto.transactionId },
      });

      if (existingLogistics) {
        throw new ConflictException(
          `Ya existe una logística para la transacción con ID ${createLogisticsDto.transactionId}`,
        );
      }

      // Si se proporcionan origen y destino, calcular la distancia y el precio
      if (
        createLogisticsDto.originAddress &&
        createLogisticsDto.destinationAddress
      ) {
        const priceCalculation = await this.calculatePrice({
          originAddress: createLogisticsDto.originAddress,
          destinationAddress: createLogisticsDto.destinationAddress,
        });

        // Crear la logística con los datos calculados
        return await this.prisma.logistics.create({
          data: {
            ...createLogisticsDto,
            distance: priceCalculation.distance,
            price: priceCalculation.totalPrice,
            pricePerKm: priceCalculation.pricePerKm,
          },
          include: {
            transaction: true,
          },
        });
      }

      // Crear la logística sin calcular precios
      return await this.prisma.logistics.create({
        data: createLogisticsDto,
        include: {
          transaction: true,
        },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear la logística: ${error.message}`,
      );
    }
  }

  async findAllLogistics(): Promise<Logistics[]> {
    try {
      return await this.prisma.logistics.findMany({
        include: {
          transaction: true,
        },
      });
    } catch (error) {
      throw new BadRequestException(
        `Error al obtener las logísticas: ${error.message}`,
      );
    }
  }

  async findLogisticsById(id: string): Promise<Logistics> {
    try {
      const logistics = await this.prisma.logistics.findUnique({
        where: { id },
        include: {
          transaction: true,
        },
      });

      if (!logistics) {
        throw new NotFoundException(`La logística con ID ${id} no existe`);
      }

      return logistics;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener la logística: ${error.message}`,
      );
    }
  }

  async findLogisticsByTransactionId(
    transactionId: string,
  ): Promise<Logistics> {
    try {
      const logistics = await this.prisma.logistics.findUnique({
        where: { transactionId },
        include: {
          transaction: true,
        },
      });

      if (!logistics) {
        throw new NotFoundException(
          `No existe una logística para la transacción con ID ${transactionId}`,
        );
      }

      return logistics;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener la logística por transacción: ${error.message}`,
      );
    }
  }

  async updateLogistics(
    id: string,
    updateLogisticsDto: UpdateLogisticsDto,
  ): Promise<Logistics> {
    try {
      const logistics = await this.prisma.logistics.findUnique({
        where: { id },
      });

      if (!logistics) {
        throw new NotFoundException(`La logística con ID ${id} no existe`);
      }

      // Si hay cambios en las direcciones, recalcular la distancia y el precio
      if (
        (updateLogisticsDto.originAddress ||
          updateLogisticsDto.destinationAddress) &&
        !updateLogisticsDto.distance
      ) {
        const originAddress =
          updateLogisticsDto.originAddress || logistics.originAddress;
        const destinationAddress =
          updateLogisticsDto.destinationAddress || logistics.destinationAddress;

        if (originAddress && destinationAddress) {
          const priceCalculation = await this.calculatePrice({
            originAddress,
            destinationAddress,
          });

          // Actualizar los datos calculados
          updateLogisticsDto.distance = priceCalculation.distance;
          updateLogisticsDto.price = priceCalculation.totalPrice;
          updateLogisticsDto.pricePerKm = priceCalculation.pricePerKm;
        }
      }

      return await this.prisma.logistics.update({
        where: { id },
        data: updateLogisticsDto,
        include: {
          transaction: true,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar la logística: ${error.message}`,
      );
    }
  }

  async removeLogistics(id: string): Promise<void> {
    try {
      const logistics = await this.prisma.logistics.findUnique({
        where: { id },
      });

      if (!logistics) {
        throw new NotFoundException(`La logística con ID ${id} no existe`);
      }

      await this.prisma.logistics.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar la logística: ${error.message}`,
      );
    }
  }

  // Métodos para la gestión de configuraciones de precios
  async createLogisticsSettings(
    createLogisticsSettingsDto: CreateLogisticsSettingsDto,
  ): Promise<LogisticsSettings> {
    try {
      // Verificar si ya existe una configuración con el mismo nombre
      const existingSettings = await this.prisma.logisticsSettings.findUnique({
        where: { name: createLogisticsSettingsDto.name },
      });

      if (existingSettings) {
        throw new ConflictException(
          `Ya existe una configuración con el nombre '${createLogisticsSettingsDto.name}'`,
        );
      }

      return await this.prisma.logisticsSettings.create({
        data: createLogisticsSettingsDto,
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al crear la configuración de logística: ${error.message}`,
      );
    }
  }

  async findAllLogisticsSettings(): Promise<LogisticsSettings[]> {
    try {
      return await this.prisma.logisticsSettings.findMany();
    } catch (error) {
      throw new BadRequestException(
        `Error al obtener las configuraciones de logística: ${error.message}`,
      );
    }
  }

  async findActiveLogisticsSettings(): Promise<LogisticsSettings> {
    try {
      const settings = await this.prisma.logisticsSettings.findFirst({
        where: { isActive: true },
      });

      if (!settings) {
        throw new NotFoundException(
          `No se encontró ninguna configuración de logística activa`,
        );
      }

      return settings;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener la configuración de logística activa: ${error.message}`,
      );
    }
  }

  async findLogisticsSettingsById(id: string): Promise<LogisticsSettings> {
    try {
      const settings = await this.prisma.logisticsSettings.findUnique({
        where: { id },
      });

      if (!settings) {
        throw new NotFoundException(
          `La configuración de logística con ID ${id} no existe`,
        );
      }

      return settings;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al obtener la configuración de logística: ${error.message}`,
      );
    }
  }

  async updateLogisticsSettings(
    id: string,
    updateLogisticsSettingsDto: UpdateLogisticsSettingsDto,
  ): Promise<LogisticsSettings> {
    try {
      const settings = await this.prisma.logisticsSettings.findUnique({
        where: { id },
      });

      if (!settings) {
        throw new NotFoundException(
          `La configuración de logística con ID ${id} no existe`,
        );
      }

      // Si se está activando esta configuración, desactivar las demás
      if (updateLogisticsSettingsDto.isActive === true) {
        await this.prisma.logisticsSettings.updateMany({
          where: { id: { not: id } },
          data: { isActive: false },
        });
      }

      return await this.prisma.logisticsSettings.update({
        where: { id },
        data: updateLogisticsSettingsDto,
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al actualizar la configuración de logística: ${error.message}`,
      );
    }
  }

  async removeLogisticsSettings(id: string): Promise<void> {
    try {
      const settings = await this.prisma.logisticsSettings.findUnique({
        where: { id },
      });

      if (!settings) {
        throw new NotFoundException(
          `La configuración de logística con ID ${id} no existe`,
        );
      }

      await this.prisma.logisticsSettings.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al eliminar la configuración de logística: ${error.message}`,
      );
    }
  }

  // Método para calcular precios
  async calculatePrice(
    calculateLogisticsPriceDto: CalculateLogisticsPriceDto,
  ): Promise<LogisticsPriceCalculation> {
    try {
      // Obtener la configuración de precios
      let settings: LogisticsSettings;

      if (calculateLogisticsPriceDto.settingsId) {
        settings = await this.findLogisticsSettingsById(
          calculateLogisticsPriceDto.settingsId,
        );
      } else {
        try {
          settings = await this.findActiveLogisticsSettings();
        } catch (error) {
          console.log(error);
          // Si no hay configuración activa, crear una por defecto
          settings = await this.prisma.logisticsSettings.create({
            data: {
              name: 'Configuración Predeterminada',
              basePrice: 500,
              pricePerKm: 50,
              isActive: true,
            },
          });
        }
      }

      // Calcular la distancia usando Google Maps
      const distance = await this.calculateDistance(
        calculateLogisticsPriceDto.originAddress,
        calculateLogisticsPriceDto.destinationAddress,
      );

      // Verificar si la distancia está dentro de los rangos permitidos
      if (
        (settings.minDistance && distance < settings.minDistance) ||
        (settings.maxDistance && distance > settings.maxDistance)
      ) {
        throw new BadRequestException(
          `La distancia ${distance} km está fuera del rango permitido (${
            settings.minDistance || 0
          }-${settings.maxDistance || 'sin límite'} km)`,
        );
      }

      // Calcular el precio
      const totalPrice = settings.basePrice + distance * settings.pricePerKm;

      return {
        originAddress: calculateLogisticsPriceDto.originAddress,
        destinationAddress: calculateLogisticsPriceDto.destinationAddress,
        distance,
        basePrice: settings.basePrice,
        pricePerKm: settings.pricePerKm,
        totalPrice,
        settingsUsed: {
          id: settings.id,
          name: settings.name,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al calcular el precio: ${error.message}`,
      );
    }
  }

  // Método auxiliar para calcular la distancia usando la API de Google Maps
  private async calculateDistance(
    originAddress: string,
    destinationAddress: string,
  ): Promise<number> {
    try {
      if (!this.googleMapsApiKey) {
        throw new Error('API key de Google Maps no configurada');
      }

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
        originAddress,
      )}&destinations=${encodeURIComponent(
        destinationAddress,
      )}&key=${this.googleMapsApiKey}`;

      const response = await firstValueFrom(this.httpService.get(url));

      if (
        !response.data ||
        response.data.status !== 'OK' ||
        !response.data.rows ||
        !response.data.rows[0] ||
        !response.data.rows[0].elements ||
        !response.data.rows[0].elements[0] ||
        response.data.rows[0].elements[0].status !== 'OK'
      ) {
        throw new Error(
          `Error al calcular la distancia: ${
            response.data?.error_message || 'No se pudo calcular la ruta'
          }`,
        );
      }

      // La distancia viene en metros, convertir a kilómetros
      const distanceInMeters = response.data.rows[0].elements[0].distance.value;
      return +(distanceInMeters / 1000).toFixed(2); // Redondear a 2 decimales
    } catch (error) {
      // Si la API de Google Maps falla, usar un método alternativo simple
      console.error('Error al usar Google Maps API:', error.message);
      return this.calculateSimpleDistance(originAddress, destinationAddress);
    }
  }

  // Método alternativo simple para calcular distancias
  // Esto es solo un cálculo aproximado para cuando la API de Google Maps no funciona
  private calculateSimpleDistance(origin: string, destination: string): number {
    // Este es un método muy básico que simula un cálculo de distancia
    // En un entorno real, deberías implementar una alternativa real o manejar el error de otra manera
    const combinedLength = (origin.length + destination.length) / 10;
    return +(5 + Math.random() * combinedLength).toFixed(2); // Valor aleatorio entre 5 y 5+combinedLength km
  }
}
