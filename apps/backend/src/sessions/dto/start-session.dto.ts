import { IsString, IsOptional, IsDateString } from 'class-validator';

export class StartSessionDto {
  @IsString()
  userId: string;

  @IsString()
  discordId: string;

  @IsString()
  gameName: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsString()
  source: 'discord';
}
