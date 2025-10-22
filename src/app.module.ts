import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { DbModule } from './db/db.module';
import { ConfigModule } from '@nestjs/config';
import { ProjectModule } from './project/project.module';
import { TaskModule } from './task/task.module';
import { CommentModule } from './comment/comment.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        AuthModule,
        UserModule,
        DbModule,
        ProjectModule,
        TaskModule,
        CommentModule,
        AnalyticsModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: RolesGuard,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: LoggingInterceptor,
        },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(LoggerMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
