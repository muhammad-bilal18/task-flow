import { Injectable } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma';

@Injectable()
export class DbService extends PrismaClient {
    constructor() {
        super({
            datasources: {
                db: {
                    url: "postgresql://bilal:1234@localhost:5432/task_flow?schema=public"
                }
            }
        });
    }
}
