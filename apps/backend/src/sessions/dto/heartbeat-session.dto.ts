import { IsString } from 'class-validator';

export class HeartbeatSessionDto {
  @IsString()
  userId: string;
}
