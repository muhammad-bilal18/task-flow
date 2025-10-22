import {
    ConflictException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { EditUserRequest } from './dto';
import { Role } from '@prisma/client';

@Injectable()
export class UserService {
    @Inject(DbService)
    private db: DbService;

    async findByEmail(email: string) {
        return this.db.user.findUnique({
            where: { email },
        });
    }

    async findById(id: string) {
        const user = await this.db.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async findAll() {
        return this.db.user.findMany({
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        projectsCreated: true,
                        projects: true,
                        tasks: true,
                        comments: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async update(
        userId: string,
        data: EditUserRequest,
        requestingUserId: string,
        requestingUserRole: Role,
    ) {
        // Check if user exists
        const user = await this.db.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Only allow users to update their own profile unless admin
        if (userId !== requestingUserId && requestingUserRole !== Role.ADMIN) {
            throw new ForbiddenException('You can only update your own profile');
        }

        // If email is being changed, check for uniqueness
        if (data.email && data.email !== user.email) {
            const existingUser = await this.db.user.findUnique({
                where: { email: data.email },
            });

            if (existingUser) {
                throw new ConflictException('Email already in use');
            }
        }

        return this.db.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                updatedAt: true,
            },
        });
    }

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

    async delete(userId: string) {
        const user = await this.db.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        await this.db.user.delete({
            where: { id: userId },
        });

        return { message: 'User deleted successfully' };
    }

    async getUserProjects(userId: string) {
        return this.db.project.findMany({
            where: {
                OR: [{ createdById: userId }, { members: { some: { id: userId } } }],
            },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                _count: {
                    select: {
                        members: true,
                        tasks: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getUserTasks(userId: string) {
        return this.db.task.findMany({
            where: { assignedToId: userId },
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                _count: {
                    select: {
                        comments: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getUserStats(userId: string) {
        const user = await this.db.user.findUnique({
            where: { id: userId },
            include: {
                _count: {
                    select: {
                        projectsCreated: true,
                        projects: true,
                        tasks: true,
                        comments: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const taskStats = await this.db.task.groupBy({
            by: ['status'],
            where: { assignedToId: userId },
            _count: true,
        });

        return {
            userId: user.id,
            projectsCreated: user._count.projectsCreated,
            projectsMemberOf: user._count.projects,
            totalProjects: user._count.projectsCreated + user._count.projects,
            tasksAssigned: user._count.tasks,
            commentsWritten: user._count.comments,
            tasksByStatus: taskStats.reduce(
                (acc, stat) => {
                    acc[stat.status] = stat._count;
                    return acc;
                },
                {} as Record<string, number>,
            ),
        };
    }
}
