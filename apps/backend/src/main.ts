import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { Logger } from 'nestjs-pino';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const docsEnabled =
    process.env.ENABLE_API_DOCS === 'true' ||
    (process.env.ENABLE_API_DOCS !== 'false' &&
      process.env.NODE_ENV !== 'production');

  if (docsEnabled) {
    const config = new DocumentBuilder()
      .setTitle('RAID Backend API')
      .setDescription(
        'NestJS backend for the RAID gaming platform.\n\n' +
          '- **Mobile app / web dashboard** — authenticated with a Supabase JWT (`Bearer` scheme).\n' +
          '- **Discord bot** — authenticated with an internal API key (`x-api-key` header).\n\n' +
          'Every endpoint documents *who* calls it under **Called by:** in the description.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Supabase JWT — obtained from `supabase.auth.currentSession.accessToken` in the mobile app or web dashboard.',
        },
        'bearer',
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'x-api-key',
          in: 'header',
          description: 'Internal API key (`API_KEY` env var). Only the Discord bot should hold this.',
        },
        'apiKey',
      )
      .addTag(
        'Games',
        'Game catalog. IGDB search and import for the mobile app; internal name resolver used by the Discord bot to map Rich Presence strings to canonical DB rows.',
      )
      .addTag(
        'Sessions',
        'Game session lifecycle — start, heartbeat, end. Written by the Discord bot as users play. The mobile app reads sessions directly from Supabase, not through these endpoints.',
      )
      .addTag(
        'Presence',
        'Live presence broadcasting. Publishes real-time `game_presence` events to a per-user Supabase Realtime channel consumed by the mobile app’s live-session card.',
      )
      .addTag(
        'Discord',
        'Discord integration. Keeps the `profiles.in_guild` flag in sync so the backend knows which users are in the RAID server and therefore eligible for Rich Presence tracking.',
      )
      .addTag(
        'Health',
        'Service health probes for Northflank orchestration and external uptime monitors.',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);

    app
      .getHttpAdapter()
      .getInstance()
      .get('/openapi.json', (_req: Request, res: Response) => {
        res.json(document);
      });

    app.use(
      '/reference',
      apiReference({
        content: document,
        theme: 'deepSpace',
        layout: 'modern',
        defaultOpenFirstTag: false,
        hideClientButton: false,
        showSidebar: true,
        showDeveloperTools: 'localhost',
        // `showToolbar` is valid at runtime but not yet in @scalar/nestjs-api-reference types
        ...({ showToolbar: 'localhost' } as Record<string, unknown>),
        operationTitleSource: 'summary',
        persistAuth: false,
        telemetry: true,
        externalUrls: {
          dashboardUrl: 'https://dashboard.scalar.com',
          registryUrl: 'https://registry.scalar.com',
          proxyUrl: 'https://proxy.scalar.com',
          apiBaseUrl: 'https://api.scalar.com',
        },
        isEditable: false,
        isLoading: false,
        hideModels: false,
        documentDownloadType: 'both',
        hideTestRequestButton: false,
        hideSearch: false,
        showOperationId: false,
        hideDarkModeToggle: false,
        withDefaultFonts: true,
        defaultOpenAllTags: false,
        expandAllModelSections: false,
        expandAllResponses: false,
        orderSchemaPropertiesBy: 'alpha',
        orderRequiredPropertiesFirst: true,
      }),
    );
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
bootstrap();
