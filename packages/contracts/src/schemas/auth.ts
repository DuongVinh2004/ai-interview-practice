import { z } from 'zod';
import { UserRole, UserStatus } from '../enums';

export const RegisterDtoSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    ),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
});

export type RegisterDto = z.infer<typeof RegisterDtoSchema>;

export const LoginDtoSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const RefreshTokenDtoSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenDto = z.infer<typeof RefreshTokenDtoSchema>;

export const ChangePasswordDtoSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(100)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    ),
});

export type ChangePasswordDto = z.infer<typeof ChangePasswordDtoSchema>;

export const UserDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  mfaEnabled: z.boolean().default(false),
  createdAt: z.string(),
  profile: z
    .object({
      id: z.string().uuid(),
      fullName: z.string(),
      targetRole: z.string().nullable().optional(),
      targetLevel: z.string().nullable().optional(),
      bio: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type UserDto = z.infer<typeof UserDtoSchema>;

export const AuthResponseSchema = z.object({
  user: UserDtoSchema.optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().optional(),
  mfaRequired: z.boolean().optional(),
  mfaSessionToken: z.string().optional(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const JwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  mfaVerified: z.boolean().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export const MfaSetupResponseSchema = z.object({
  secret: z.string(),
  otpauthUrl: z.string(),
  issuer: z.string(),
  accountName: z.string(),
});

export type MfaSetupResponse = z.infer<typeof MfaSetupResponseSchema>;

export const MfaEnableDtoSchema = z.object({
  code: z.string().length(6, 'TOTP verification code must be 6 digits'),
});

export type MfaEnableDto = z.infer<typeof MfaEnableDtoSchema>;

export const MfaEnableResponseSchema = z.object({
  success: z.boolean(),
  mfaEnabled: z.boolean(),
  recoveryCodes: z.array(z.string()),
  message: z.string(),
});

export type MfaEnableResponse = z.infer<typeof MfaEnableResponseSchema>;

export const MfaVerifyDtoSchema = z.object({
  mfaSessionToken: z.string().min(1, 'MFA session token is required'),
  code: z.string().length(6, 'TOTP verification code must be 6 digits'),
});

export type MfaVerifyDto = z.infer<typeof MfaVerifyDtoSchema>;

export const MfaRecoveryVerifyDtoSchema = z.object({
  mfaSessionToken: z.string().min(1, 'MFA session token is required'),
  recoveryCode: z.string().min(8, 'Recovery code is required'),
});

export type MfaRecoveryVerifyDto = z.infer<typeof MfaRecoveryVerifyDtoSchema>;

export const MfaDisableDtoSchema = z.object({
  password: z.string().min(1, 'Password is required to disable MFA'),
  code: z.string().min(6, 'TOTP code or recovery code is required'),
});

export type MfaDisableDto = z.infer<typeof MfaDisableDtoSchema>;
