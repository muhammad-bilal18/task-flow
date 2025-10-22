import {
    ConflictException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
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
        const existingUser = await this.db.user.findUnique({
            where: { email: dto.email },
        });

        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }
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
    }

    async signin(dto: SignInRequest) {
        const user = await this.db.user.findUnique({
            where: {
                email: dto.email,
            },
        });
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const pwMatches = await argon2.verify(user.password, dto.password);
        if (!pwMatches) throw new UnauthorizedException('Invalid credentials');

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

    async validateUser(userId: string) {
        const user = await this.db.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return user;
    }

    /**
     * Refresh token (optional - if you want to implement refresh tokens)
     */
    async refreshToken(userId: string) {
        const user = await this.db.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const token = this.generateJwt(user.id, user.email);

        return {
            access_token: token,
        };
    }

    async verifyToken(token: string) {
        try {
            const payload = this.jwtService.verify(token);
            return payload;
        } catch (error) {
            throw new UnauthorizedException('Invalid token');
        }
    }
}
