import { IsString, IsOptional, IsDateString, IsIn, IsNotEmpty } from 'class-validator';

export class StartSessionDto {
  @IsString()
  userId: string;

  @IsString()
  discordId: string;

  @IsString()
  @IsNotEmpty()
  gameName: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsIn(['discord'])
  source: 'discord';
}
