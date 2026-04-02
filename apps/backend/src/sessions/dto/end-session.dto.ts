import { IsString, IsOptional } from 'class-validator';

export class EndSessionDto {
  @IsString()
  userId: string;

  @IsString()
  discordId: string;

  @IsOptional()
  @IsString()
  source?: string;
}
