import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SearchGamesDto {
  @ApiProperty({
    description: 'Substring search against the IGDB catalog. Case-insensitive.',
    example: 'red dead',
  })
  @IsString()
  query: string;

  @ApiProperty({
    description: 'Maximum number of results to return.',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 50,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;
}
