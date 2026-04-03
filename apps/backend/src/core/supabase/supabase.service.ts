import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient;

  constructor(
    private config: ConfigService,
    @InjectPinoLogger(SupabaseService.name) private logger: PinoLogger,
  ) {}

  onModuleInit() {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    const serviceKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_KEY');

    this.client = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.info('Supabase client initialized');
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
