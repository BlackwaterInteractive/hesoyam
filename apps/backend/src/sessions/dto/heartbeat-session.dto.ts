import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HeartbeatSessionDto {
  @ApiProperty({
    description: 'RAID user UUID whose active session should be kept alive.',
    example: 'a3b9f2c1-7d4e-4a8b-9c1f-2e5d6a7b8c9d',
  })
  @IsString()
  userId: string;
}
