import { IsString, IsOptional, IsIn } from 'class-validator';

export class EndSessionDto {
  @IsString()
  userId: string;

  @IsString()
  discordId: string;

  @IsOptional()
  @IsIn(['discord'])
  source?: 'discord';
}
