import { IsInt } from 'class-validator';

export class ImportGameDto {
  @IsInt()
  igdbId: number;
}
