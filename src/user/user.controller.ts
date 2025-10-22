import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { GetUser } from 'src/auth/decorator';
import { JwtGuard } from 'src/auth/guard';
import { EditUserRequest } from './dto';
import { UserService } from './user.service';

@UseGuards(JwtGuard)
@Controller('users')
export class UserController {
    @Inject(UserService)
    private userService: UserService;

    @Get('me')
    getMe(@GetUser() user: User) {
        return { user };
    }

    @Patch()
    editUser(@GetUser('id') userId: string, @Body() body: EditUserRequest) {
        return this.userService.editUser(userId, body);
    }
}
