import { IsString, MinLength } from 'class-validator';

export class SlackOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;
}

export class GmailOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;
}

export class GitHubOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;
}

export class NotionOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;
}

export class LinearOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;
}

export class JiraOAuthExchangeDto {
  @IsString()
  @MinLength(5)
  code!: string;
}
