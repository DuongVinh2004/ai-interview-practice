import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterRequestDto {
  @ApiProperty({ example: 'candidate@example.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(100)
  fullName!: string;
}

export class LoginRequestDto {
  @ApiProperty({ example: 'candidate@example.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;
}

export class RefreshTokenRequestDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken!: string;
}

export class ChangePasswordRequestDto {
  @ApiProperty({ example: 'OldPassword123' })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword!: string;

  @ApiProperty({ example: 'NewPassword123' })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword!: string;
}

export class MfaEnableRequestDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP verification code' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'TOTP code must be 6 digits' })
  code!: string;
}

export class MfaVerifyRequestDto {
  @ApiProperty({ description: 'MFA session token received during initial login' })
  @IsString()
  @IsNotEmpty()
  mfaSessionToken!: string;

  @ApiProperty({ example: '123456', description: '6-digit TOTP code' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'TOTP code must be 6 digits' })
  code!: string;
}

export class MfaRecoveryVerifyRequestDto {
  @ApiProperty({ description: 'MFA session token received during initial login' })
  @IsString()
  @IsNotEmpty()
  mfaSessionToken!: string;

  @ApiProperty({ example: 'ABCD-1234-EF', description: 'Single-use backup recovery code' })
  @IsString()
  @IsNotEmpty()
  recoveryCode!: string;
}

export class MfaDisableRequestDto {
  @ApiProperty({ example: 'Password123' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
