import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from './core/core.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';
import { GamesModule } from './games/games.module';
import { IgdbModule } from './igdb/igdb.module';
import { PresenceModule } from './presence/presence.module';
import { UsersModule } from './users/users.module';
import { DiscordModule } from './discord/discord.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production'
        ? '.env.production'
        : '.env.staging',
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        level: process.env.LOG_LEVEL ?? 'info',
      },
    }),
    ScheduleModule.forRoot(),
    CoreModule,
    AuthModule,
    SessionsModule,
    GamesModule,
    IgdbModule,
    PresenceModule,
    UsersModule,
    DiscordModule,
    HealthModule,
  ],
})
export class AppModule {}
