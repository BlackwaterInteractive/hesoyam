import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase/supabase.service';
import { CacheService } from './cache/cache.service';

@Global()
@Module({
  providers: [SupabaseService, CacheService],
  exports: [SupabaseService, CacheService],
})
export class CoreModule {}
