import { Body, Controller, Inject, Post } from '@nestjs/common'
import { AuthService } from './auth.service'
import { SignInRequest, SignUpRequest } from 'src/dto'

@Controller('auth')
export class AuthController {
    @Inject(AuthService)
    private readonly authService: AuthService

    @Post('signup')
    signup(@Body() dto: SignUpRequest) {
        return this.authService.signup(dto)
    }

    @Post('signin')
    signin(@Body() dto: SignInRequest) {
        this.authService.signin(dto)
    }
}
