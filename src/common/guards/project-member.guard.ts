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
export class ProjectMemberGuard implements CanActivate {
    @Inject(DbService)
    private db: DbService;

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const projectId = request.params.projectId || request.params.id;

        if (!projectId) {
            throw new ForbiddenException('Project ID is required');
        }

        // Admin has access to all projects
        if (user.role === Role.ADMIN) {
            return true;
        }

        // Check if user is project creator or member
        const project = await this.db.project.findUnique({
            where: { id: projectId },
            include: {
                members: {
                    where: { id: user.id },
                },
            },
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        const hasAccess = project.createdById === user.id || project.members.length > 0;

        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this project');
        }

        return true;
    }
}
