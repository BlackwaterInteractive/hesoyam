import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from '../guards/api-key.guard';

export function RequireApiKey() {
  return applyDecorators(
    UseGuards(ApiKeyGuard),
    ApiSecurity('apiKey'),
    ApiUnauthorizedResponse({ description: 'Invalid or missing API key' }),
  );
}
