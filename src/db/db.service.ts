import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DbService extends PrismaClient {
    constructor(private config: ConfigService) {
        super({
            datasources: {
                db: {
                    url: config.get('DATABASE_URL'),
                },
            },
        });
    }

    cleanDb() {
        return this.$transaction([
            this.comment.deleteMany(),
            this.task.deleteMany(),
            this.project.deleteMany(),
            this.user.deleteMany(),
        ]);
    }
}
