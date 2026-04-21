import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EndSessionDto {
  @ApiProperty({
    description: 'RAID user UUID whose active session should be ended.',
    example: 'a3b9f2c1-7d4e-4a8b-9c1f-2e5d6a7b8c9d',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Discord user ID (snowflake). Used for audit logging.',
    example: '123456789012345678',
  })
  @IsString()
  discordId: string;

  @ApiProperty({
    description: 'Source filter. When omitted, ends the most recent active session regardless of source.',
    example: 'discord',
    enum: ['discord'],
    required: false,
  })
  @IsOptional()
  @IsIn(['discord'])
  source?: 'discord';
}
