import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportGameDto {
  @ApiProperty({
    description:
      'Numeric IGDB game ID. Obtained from the `id` field of a result returned by `GET /games/search`.',
    example: 25076,
  })
  @IsInt()
  igdbId: number;
}
