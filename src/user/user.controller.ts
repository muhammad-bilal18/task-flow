import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Inject,
    Param,
    Patch,
} from '@nestjs/common';
import { Role, type User } from '@prisma/client';
import { EditUserRequest } from './dto';
import { UserService } from './user.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('users')
export class UserController {
    @Inject(UserService)
    private userService: UserService;

    @Get('me')
    getMe(@CurrentUser() user: User) {
        return { user };
    }

    @Patch(':id')
    editUser(@Body() body: EditUserRequest, @CurrentUser() user: User, @Param('id') id: string) {
        return this.userService.update(id, body, user.id, user.role);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    deleteUser(@Param('id') id: string) {
        return this.userService.delete(id);
    }

    @Patch(':id/promote-to-admin')
    @Roles(Role.ADMIN)
    promoteToAdmin(@Param('id') id: string) {
        return this.userService.promoteToAdmin(id);
    }

    @Get(':id/projects')
    getUserProjects(@Param('id') id: string, @CurrentUser() user: User) {
        if (user.id !== id && user.role !== Role.ADMIN) {
            throw new ForbiddenException('You can only fetch your own projects');
        }
        return this.userService.getUserProjects(id);
    }

    @Get(':id/tasks')
    getUserTasks(@Param('id') id: string, @CurrentUser() user: User) {
        if (user.id !== id && user.role !== Role.ADMIN) {
            throw new ForbiddenException('You can only fetch your own tasks');
        }
        return this.userService.getUserTasks(id);
    }

    @Get(':id/stats')
    getUserStats(@Param('id') id: string, @CurrentUser() user: User) {
        if (user.id !== id && user.role !== Role.ADMIN) {
            throw new ForbiddenException('You can only fetch your own stats');
        }
        return this.userService.getUserStats(id);
    }
}
