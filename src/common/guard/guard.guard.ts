import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { envs } from 'src/config/envs.config';
import { RequestWithUser, JwtPayload } from '../interfaces/auth.interface';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extracttokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: envs.jwtSecret,
      });

      if (!payload || !payload.sub || !payload.role) {
        throw new UnauthorizedException('Token inválido');
      }

      const roles =
        this.reflector.get<string[]>('roles', context.getHandler()) ||
        this.reflector.get<string[]>('roles', context.getClass());

      if (roles && roles.length > 0) {
        const hasRole = roles.includes(payload.role);
        if (!hasRole) {
          throw new UnauthorizedException('No tienes los permisos necesarios');
        }
      }

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private extracttokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
