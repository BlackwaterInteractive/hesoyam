import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { PresenceBroadcastPayload } from '../presence.service';

export class PresenceBroadcastDto implements PresenceBroadcastPayload {
  @ApiProperty({
    description: 'RAID user UUID whose presence channel to broadcast on.',
    example: 'a3b9f2c1-7d4e-4a8b-9c1f-2e5d6a7b8c9d',
  })
  @IsString()
  user_id: string;

  @ApiProperty({
    description:
      'Event type. `start` when the game begins, `heartbeat` every 30 seconds while playing, `end` when the game closes.',
    enum: ['start', 'end', 'heartbeat'],
    example: 'start',
  })
  @IsIn(['start', 'end', 'heartbeat'])
  event: 'start' | 'end' | 'heartbeat';

  @ApiProperty({
    description: 'Game name. Null when the event is `end`.',
    example: "Assassin's Creed Valhalla",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  game_name: string | null;

  @ApiProperty({
    description: 'Game slug from the catalog. Null when the event is `end`.',
    example: 'assassins-creed-valhalla',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  game_slug: string | null;

  @ApiProperty({
    description: 'Cover art URL. Null when the event is `end` or no cover is stored.',
    example: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2a3f.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  cover_url: string | null;

  @ApiProperty({
    description: 'Session start timestamp (ISO 8601). Null when the event is `end`.',
    example: '2026-04-20T12:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  started_at: string | null;
}
