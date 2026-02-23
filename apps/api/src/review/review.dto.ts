import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewDecisionDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ReviewQueueQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  includeResolved?: 'true' | 'false';
}
