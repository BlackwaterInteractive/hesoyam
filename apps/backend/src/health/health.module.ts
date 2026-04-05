import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { IgdbModule } from '../igdb/igdb.module';

@Module({
  imports: [IgdbModule],
  controllers: [HealthController],
})
export class HealthModule {}
