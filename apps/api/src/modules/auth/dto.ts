import { createZodDto } from 'nestjs-zod';
import {
  loginSchema,
  signupSchema,
  refreshSchema,
  forgotSchema,
  resetSchema,
  switchCompanySchema,
  changePasswordSchema,
} from '@leadflow/shared';

export class LoginDto extends createZodDto(loginSchema) {}
export class SignupDto extends createZodDto(signupSchema) {}
export class RefreshDto extends createZodDto(refreshSchema) {}
export class ForgotDto extends createZodDto(forgotSchema) {}
export class ResetDto extends createZodDto(resetSchema) {}
export class SwitchCompanyDto extends createZodDto(switchCompanySchema) {}
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
