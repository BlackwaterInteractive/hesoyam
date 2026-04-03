import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../guards/jwt.guard';

export function RequireJwt() {
  return applyDecorators(UseGuards(JwtGuard));
}
