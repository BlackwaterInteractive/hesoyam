import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveGameDto {
  @ApiProperty({
    description:
      'Raw game name as observed by Discord Rich Presence. May include trademark symbols, casing variations, and edition suffixes.',
    example: "Assassin's Creed Valhalla",
  })
  @IsString()
  @IsNotEmpty()
  gameName: string;

  @ApiProperty({
    description:
      'Discord application ID for the game, if available. Provides an unambiguous fast-path match — bypasses name-based lookups and IGDB when present.',
    example: '356875570916753438',
    required: false,
  })
  @IsOptional()
  @IsString()
  applicationId?: string;
}
