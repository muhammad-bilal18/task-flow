import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInRequest, SignUpRequest } from 'src/auth/dto';

@Controller('auth')
export class AuthController {
    @Inject(AuthService)
    private authService: AuthService;

    @Post('signup')
    signup(@Body() dto: SignUpRequest) {
        return this.authService.signup(dto);
    }

    @HttpCode(HttpStatus.OK)
    @Post('signin')
    signin(@Body() dto: SignInRequest) {
        return this.authService.signin(dto);
    }
}
