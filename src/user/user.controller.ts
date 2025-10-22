import { Body, Controller, Delete, Get, Inject, Param, Patch, UseGuards } from '@nestjs/common';
import { Role, type User } from '@prisma/client';
import { GetUser } from 'src/auth/decorator';
import { EditUserRequest } from './dto';
import { UserService } from './user.service';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('users')
export class UserController {
    @Inject(UserService)
    private userService: UserService;

    @Get('me')
    getMe(@GetUser() user: User) {
        return { user };
    }

    @Patch(':id')
    editUser(@Body() body: EditUserRequest, @GetUser() user: User, @Param('id') id: string) {
        return this.userService.update(id, body, user.id, user.role);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    deleteUser(@GetUser() user: User, @Param('id') id: string) {
        return this.userService.delete(id);
    }
}
