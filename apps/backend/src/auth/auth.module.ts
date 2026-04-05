import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './guards/api-key.guard';
import { JwtGuard } from './guards/jwt.guard';

@Module({
  providers: [ApiKeyGuard, JwtGuard],
  exports: [ApiKeyGuard, JwtGuard],
})
export class AuthModule {}
