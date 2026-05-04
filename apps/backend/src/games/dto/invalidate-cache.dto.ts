import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class InvalidateApplicationCacheDto {
  @ApiProperty({
    description:
      'Discord application IDs whose resolver-cache entries should be dropped. Called by the admin Consolidate Games action after a junction-row move so the in-memory LRU stops serving the now-deleted orphan game id (issue #194 PR 2).',
    example: ['1223210479246376960', '1210430430172680212'],
    type: [String],
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  applicationIds!: string[];
}
