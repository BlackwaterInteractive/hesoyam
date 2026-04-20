import { IsString, IsOptional, IsDateString, IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartSessionDto {
  @ApiProperty({
    description: 'RAID user UUID (matches `profiles.id`).',
    example: 'a3b9f2c1-7d4e-4a8b-9c1f-2e5d6a7b8c9d',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Discord user ID (snowflake).',
    example: '123456789012345678',
  })
  @IsString()
  discordId: string;

  @ApiProperty({
    description: 'Game name as observed from Discord Rich Presence. Will be resolved via `POST /games/resolve`.',
    example: "Assassin's Creed Valhalla",
  })
  @IsString()
  @IsNotEmpty()
  gameName: string;

  @ApiProperty({
    description:
      'Discord application ID for the game, if available. Passed to the resolver for an unambiguous fast-path match.',
    example: '356875570916753438',
    required: false,
  })
  @IsOptional()
  @IsString()
  applicationId?: string;

  @ApiProperty({
    description: 'Session start timestamp (ISO 8601). Defaults to the current time on the server if omitted.',
    example: '2026-04-20T12:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiProperty({
    description: 'Origin of the session. Only `discord` is supported in V1.',
    example: 'discord',
    enum: ['discord'],
  })
  @IsIn(['discord'])
  source: 'discord';
}
