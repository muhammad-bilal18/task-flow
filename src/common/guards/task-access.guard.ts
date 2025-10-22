import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    NotFoundException,
    Inject,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { DbService } from 'src/db/db.service';

@Injectable()
export class TaskAccessGuard implements CanActivate {
    @Inject(DbService)
    private db: DbService;

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const taskId = request.params.taskId || request.params.id;

        if (!taskId) {
            throw new ForbiddenException('Task ID is required');
        }

        // Admin has access to all tasks
        if (user.role === Role.ADMIN) {
            return true;
        }

        // Check if user has access to the task's project
        const task = await this.db.task.findUnique({
            where: { id: taskId },
            include: {
                project: {
                    include: {
                        members: {
                            where: { id: user.id },
                        },
                    },
                },
            },
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        const hasAccess =
            task.project.createdById === user.id ||
            task.project.members.length > 0 ||
            task.assignedToId === user.id;

        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this task');
        }

        return true;
    }
}
