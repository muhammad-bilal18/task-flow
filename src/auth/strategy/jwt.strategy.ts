import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DbService } from 'src/db/db.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    @Inject(DbService)
    private dbService: DbService;

    async validate(payload: { sub: string; email: string }) {
        const user = await this.dbService.user.findUnique({
            where: { id: payload.sub },
        });
        const { password, ...userWithoutPassword } = user!;
        return userWithoutPassword;
    }

    constructor(private config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.get('JWT_SECRET')!,
        });
    }
}
