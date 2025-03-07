import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
