import { IsString, IsOptional } from 'class-validator';

export class ResolveGameDto {
  @IsString()
  gameName: string;

  @IsOptional()
  @IsString()
  applicationId?: string;
}
