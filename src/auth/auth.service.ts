import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SignInRequest, SignUpRequest } from 'src/auth/dto';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DbService } from 'src/db/db.service';
import { Role } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class AuthService {
    @Inject(DbService)
    private db: DbService;
    @Inject(JwtService)
    private jwtService: JwtService;
    @Inject(ConfigService)
    private configService: ConfigService;

    async signup(dto: SignUpRequest) {
        try {
            const hash = await argon2.hash(dto.password);
            const user = await this.db.user.create({
                data: {
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    email: dto.email,
                    password: hash,
                    role: Role.MEMBER,
                },
            });

            return await this.generateJwt(user.id, user.email);
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002')
                throw new ForbiddenException('Email already in use');
            throw error;
        }
    }

    async signin(dto: SignInRequest) {
        const user = await this.db.user.findUnique({
            where: {
                email: dto.email,
            },
        });
        if (!user) throw new ForbiddenException('Invalid credentials');

        const pwMatches = await argon2.verify(user.password, dto.password);
        if (!pwMatches) throw new ForbiddenException('Invalid credentials');

        return await this.generateJwt(user.id, user.email);
    }

    async generateJwt(userId: string, email: string): Promise<{ access_token: string }> {
        const payload = { sub: userId, email };
        const token = await this.jwtService.signAsync(payload, {
            expiresIn: '15m',
            secret: this.configService.get('JWT_SECRET'),
        });
        return {
            access_token: token,
        };
    }

    async changePassword(userId: string, oldPassword: string, newPassword: string) {
        const user = await this.db.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Verify old password
        const isPasswordValid = await argon2.verify(user.password, oldPassword);
        if (!isPasswordValid) {
            throw new ForbiddenException('Current password is incorrect');
        }

        // Hash new password
        const hashedPassword = await argon2.hash(newPassword);

        await this.db.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        return { message: 'Password changed successfully' };
    }
}
