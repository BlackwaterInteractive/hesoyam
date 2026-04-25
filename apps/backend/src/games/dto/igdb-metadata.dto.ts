import { ApiProperty } from '@nestjs/swagger';

export class IgdbMetadataDto {
  @ApiProperty({
    description: 'Numeric IGDB game ID — same one passed in the URL path. Echoed back so callers can correlate.',
    example: 25076,
  })
  igdb_id: number;

  @ApiProperty({
    description: 'Display name as IGDB has it.',
    example: 'Elden Ring',
  })
  name: string;

  @ApiProperty({
    description: 'URL-safe IGDB slug. Used to derive the canonical IGDB page URL (`https://www.igdb.com/games/{slug}`).',
    example: 'elden-ring',
  })
  slug: string;

  @ApiProperty({
    description: 'Cover image URL (IGDB CDN, t_cover_big size). Null if IGDB has no cover for this game.',
    example: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg',
    nullable: true,
  })
  cover_url: string | null;

  @ApiProperty({
    description: 'Genre names from IGDB. Empty array if IGDB returns no genres.',
    example: ['Role-playing (RPG)', 'Adventure'],
    type: [String],
  })
  genres: string[];

  @ApiProperty({
    description: 'Primary developer name from IGDB involved_companies. Null if not available.',
    example: 'FromSoftware',
    nullable: true,
  })
  developer: string | null;

  @ApiProperty({
    description: 'Primary publisher name from IGDB involved_companies. Null if not available.',
    example: 'Bandai Namco Entertainment',
    nullable: true,
  })
  publisher: string | null;

  @ApiProperty({
    description: 'Release year derived from IGDB first_release_date. Null if IGDB has no release date.',
    example: 2022,
    nullable: true,
  })
  release_year: number | null;

  @ApiProperty({
    description: 'IGDB summary text. Null if not available.',
    example: 'A new fantasy action RPG...',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'ISO-8601 release datetime from IGDB. Null if no release date.',
    example: '2022-02-25T00:00:00.000Z',
    nullable: true,
  })
  first_release_date: string | null;

  @ApiProperty({
    description: 'Screenshot URLs (IGDB CDN, t_screenshot_big size). Empty array if none.',
    example: [
      'https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc8oah.jpg',
    ],
    type: [String],
  })
  screenshots: string[];

  @ApiProperty({
    description: 'First artwork URL from IGDB (1080p size). Null if no artwork.',
    example: 'https://images.igdb.com/igdb/image/upload/t_1080p/ar9zqy.jpg',
    nullable: true,
  })
  artwork_url: string | null;

  @ApiProperty({
    description: 'IGDB total_rating (0-100 scale). Null if no rating.',
    example: 95.21,
    nullable: true,
  })
  rating: number | null;

  @ApiProperty({
    description: 'Number of ratings IGDB aggregated. Null if no rating.',
    example: 1234,
    nullable: true,
  })
  rating_count: number | null;

  @ApiProperty({
    description: 'Platform names IGDB lists for the game. Empty array if none.',
    example: ['PC (Microsoft Windows)', 'PlayStation 5'],
    type: [String],
  })
  platforms: string[];
}
