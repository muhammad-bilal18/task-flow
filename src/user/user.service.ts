import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { EditUserRequest } from './dto';

@Injectable()
export class UserService {
    @Inject(DbService)
    private db: DbService;

    async editUser(userId: string, editUserDto: EditUserRequest) {
        if (editUserDto.email) {
            const user = await this.db.user.findUnique({ where: { email: editUserDto.email } });
            if (user && user.id !== userId) {
                throw new ForbiddenException('Email already in use');
            }
        }
        const updatedUser = await this.db.user.update({
            where: {
                id: userId,
            },
            data: { ...editUserDto },
        });

        const { password, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword;
    }
}
