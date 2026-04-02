import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class ResolveGameDto {
  @IsString()
  @IsNotEmpty()
  gameName: string;

  @IsOptional()
  @IsString()
  applicationId?: string;
}
