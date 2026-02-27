import { IsOptional, IsString, MinLength } from 'class-validator';

export class SlackOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;

  /** The state token returned by the OAuth provider. Must match the tenant from JWT. */
  @IsString()
  @IsOptional()
  state?: string;
}

export class GmailOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;

  @IsString()
  @IsOptional()
  state?: string;
}

export class GitHubOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;

  @IsString()
  @IsOptional()
  state?: string;
}

export class NotionOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;

  @IsString()
  @IsOptional()
  state?: string;
}

export class LinearOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;

  @IsString()
  @IsOptional()
  state?: string;
}

export class JiraOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;

  @IsString()
  @IsOptional()
  state?: string;
}

export class GCalOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;

  @IsString()
  @IsOptional()
  state?: string;
}
