import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { DbModule } from './db/db.module';

@Module({
  imports: [AuthModule, UserModule, DbModule],
})
export class AppModule {
  // Application root module
}
