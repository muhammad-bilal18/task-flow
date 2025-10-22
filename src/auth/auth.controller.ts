import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInRequest, SignUpRequest } from 'src/auth/dto';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
    @Inject(AuthService)
    private authService: AuthService;

    @Public()
    @Post('signup')
    signup(@Body() dto: SignUpRequest) {
        return this.authService.signup(dto);
    }

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('signin')
    signin(@Body() dto: SignInRequest) {
        return this.authService.signin(dto);
    }
}
