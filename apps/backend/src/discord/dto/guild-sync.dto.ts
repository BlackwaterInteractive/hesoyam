import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class GuildMemberDto {
  @ApiProperty({
    description: 'Discord user ID (snowflake) of a current guild member.',
    example: '123456789012345678',
  })
  @IsString()
  discordId: string;
}

export class GuildSyncDto {
  @ApiProperty({
    description:
      'Full roster of Discord user IDs currently in the RAID guild. Users in the list are marked `in_guild = true`; users previously flagged `in_guild = true` but missing from this list are reset to `false`.',
    type: [GuildMemberDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuildMemberDto)
  members: GuildMemberDto[];
}
