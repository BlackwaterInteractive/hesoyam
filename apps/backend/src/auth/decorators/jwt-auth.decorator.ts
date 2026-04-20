import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtGuard } from '../guards/jwt.guard';

export function RequireJwt() {
  return applyDecorators(
    UseGuards(JwtGuard),
    ApiBearerAuth('bearer'),
    ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' }),
  );
}
