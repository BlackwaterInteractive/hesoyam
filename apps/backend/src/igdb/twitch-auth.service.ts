import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class TwitchAuthService {
  private token: string | null = null;
  private expiresAt = 0;

  constructor(
    private config: ConfigService,
    private http: HttpService,
    @InjectPinoLogger(TwitchAuthService.name) private logger: PinoLogger,
  ) {}

  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.token && Date.now() < this.expiresAt - 60_000) {
      return this.token;
    }
    return this.refresh();
  }

  private async refresh(): Promise<string> {
    const clientId = this.config.getOrThrow<string>('TWITCH_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('TWITCH_CLIENT_SECRET');

    const response = await firstValueFrom(
      this.http.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
        },
      }),
    );

    this.token = response.data.access_token;
    this.expiresAt = Date.now() + response.data.expires_in * 1000;

    this.logger.info('Twitch OAuth token refreshed');
    return this.token!;
  }
}
