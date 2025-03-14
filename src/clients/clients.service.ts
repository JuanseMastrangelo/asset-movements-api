import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Client, Prisma } from '@prisma/client';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { SearchClientsDto } from './dto/search-clients.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto): Promise<Client> {
    const client = await this.prisma.client.create({
      data: createClientDto,
    });

    return client;
  }

  async findAll(paginationDto: PaginationDto) {
    const {
      page = 1,
      limit = 10,
      order = 'desc',
      sort = 'createdAt',
    } = paginationDto;

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          [sort]: order,
        },
      }),
      this.prisma.client.count({}),
    ]);

    return {
      items: clients,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasPreviousPage: page > 1,
        hasNextPage: page * limit < total,
      },
    };
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto): Promise<Client> {
    const client = await this.prisma.client.update({
      where: { id },
      data: updateClientDto,
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client;
  }

  async remove(id: string): Promise<Client> {
    const client = await this.prisma.client.delete({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client;
  }

  async disable(id: string) {
    return await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async enable(id: string) {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async search(searchParams: SearchClientsDto) {
    const {
      name,
      email,
      phone,
      country,
      isActive,
      createdFrom,
      createdTo,
      address,
      limit = 10,
      offset = 0,
    } = searchParams;

    const page = Math.floor(offset / limit) + 1;

    const where: Prisma.ClientWhereInput = {};

    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      };
    }

    if (email) {
      where.email = {
        contains: email,
        mode: 'insensitive',
      };
    }

    if (phone) {
      where.phone = {
        contains: phone,
      };
    }

    if (country) {
      where.country = {
        contains: country,
        mode: 'insensitive',
      };
    }

    if (address) {
      where.address = {
        contains: address,
        mode: 'insensitive',
      };
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (createdFrom || createdTo) {
      where.createdAt = {};

      if (createdFrom) {
        where.createdAt.gte = new Date(createdFrom);
      }

      if (createdTo) {
        where.createdAt.lte = new Date(createdTo);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: {
          name: 'asc',
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
