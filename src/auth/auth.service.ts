import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { DbService } from 'src/db/db.service'
import { SignInRequest, SignUpRequest } from 'src/dto'
import * as argon2 from 'argon2'
import { PrismaClientKnownRequestError } from 'generated/prisma/runtime/library'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AuthService {
    @Inject(DbService)
    private readonly db: DbService
    @Inject(JwtService)
    private readonly jwtService: JwtService
    @Inject(ConfigService)
    private readonly configService: ConfigService

    async signup(dto: SignUpRequest) {
        try {
            const hash = await argon2.hash(dto.password)
            const user = await this.db.user.create({
                data: {
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    email: dto.email,
                    password: hash,
                    role: dto.role,
                }
            })
            const { password, ...userWithoutPassword } = user
            return await this.generateJwt(user.id, user.email);
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002')
                throw new ForbiddenException('Email already in use')
            throw error
        }
    }

    async signin(dto: SignInRequest) {
        const user = await this.db.user.findUnique({
            where: {
                email: dto.email,
            }
        })

        if (!user)
            throw new ForbiddenException('Invalid credentials')

        const pwMatches = await argon2.verify(user.password, dto.password)
        if (!pwMatches)
            throw new ForbiddenException('Invalid credentials')

        const { password, ...userWithoutPassword } = user
        return await this.generateJwt(user.id, user.email);
    }

    async generateJwt(userId: string, email: string): Promise<{ access_token: string }> {
        const payload = { sub: userId, email }
        const token = await this.jwtService.signAsync(payload, {
            expiresIn: '15m',
            secret: this.configService.get('JWT_SECRET'),
        })
        return {
            access_token: token,
        }
    }
}
