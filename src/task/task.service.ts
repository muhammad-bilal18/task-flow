import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { Role, TaskStatus } from '@prisma/client';
import { DbService } from 'src/db/db.service';

@Injectable()
export class TaskService {
    @Inject(DbService)
    private db: DbService;

    /**
     * Create a new task
     */
    async create(
        data: {
            title: string;
            description?: string;
            projectId: string;
            assignedToId?: string;
        },
        userId: string,
        userRole: Role,
    ) {
        // Verify project exists
        const project = await this.db.project.findUnique({
            where: { id: data.projectId },
            include: { members: true },
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        // Check if user has access to the project
        const hasAccess =
            userRole === Role.ADMIN ||
            project.createdById === userId ||
            project.members.some((member) => member.id === userId);

        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this project');
        }

        // If assignee is provided, verify they exist and are part of the project
        if (data.assignedToId) {
            const assignee = await this.db.user.findUnique({
                where: { id: data.assignedToId },
            });

            if (!assignee) {
                throw new NotFoundException('Assignee not found');
            }

            const isAssigneeMember =
                project.createdById === data.assignedToId ||
                project.members.some((member) => member.id === data.assignedToId);

            if (!isAssigneeMember) {
                throw new ForbiddenException('Assignee is not a member of this project');
            }
        }

        return this.db.task.create({
            data: {
                title: data.title,
                description: data.description,
                projectId: data.projectId,
                assignedToId: data.assignedToId,
            },
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
                        email: true,
                    },
                },
            },
        });
    }

    /**
     * Get all tasks (filtered by project access)
     */
    async findAll(userId: string, userRole: Role, projectId?: string) {
        let where: any = {};

        if (projectId) {
            // Verify access to specific project
            const project = await this.db.project.findUnique({
                where: { id: projectId },
                include: { members: true },
            });

            if (!project) {
                throw new NotFoundException('Project not found');
            }

            const hasAccess =
                userRole === Role.ADMIN ||
                project.createdById === userId ||
                project.members.some((member) => member.id === userId);

            if (!hasAccess) {
                throw new ForbiddenException('You do not have access to this project');
            }

            where.projectId = projectId;
        } else if (userRole !== Role.ADMIN) {
            // Members can only see tasks from their projects
            const userProjects = await this.db.project.findMany({
                where: {
                    OR: [{ createdById: userId }, { members: { some: { id: userId } } }],
                },
                select: { id: true },
            });

            where.projectId = { in: userProjects.map((p) => p.id) };
        }

        return this.db.task.findMany({
            where,
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
                        email: true,
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

    /**
     * Get task by ID
     */
    async findById(taskId: string, userId: string, userRole: Role) {
        const task = await this.db.task.findUnique({
            where: { id: taskId },
            include: {
                project: {
                    include: {
                        members: true,
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                comments: {
                    include: {
                        author: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        // Check access
        const hasAccess =
            userRole === Role.ADMIN ||
            task.project.createdById === userId ||
            task.project.members.some((member) => member.id === userId);

        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this task');
        }

        return task;
    }

    /**
     * Update task
     */
    async update(
        taskId: string,
        data: {
            title?: string;
            description?: string;
            status?: TaskStatus;
            assignedToId?: string | null;
        },
        userId: string,
        userRole: Role,
    ) {
        const task = await this.db.task.findUnique({
            where: { id: taskId },
            include: {
                project: {
                    include: { members: true },
                },
            },
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        // Check if user can update this task
        const isAssignee = task.assignedToId === userId;
        const isProjectMember =
            task.project.createdById === userId ||
            task.project.members.some((member) => member.id === userId);

        if (userRole !== Role.ADMIN && !isAssignee && !isProjectMember) {
            throw new ForbiddenException('You do not have permission to update this task');
        }

        // If changing assignee, verify they're part of the project
        if (data.assignedToId) {
            const isNewAssigneeMember =
                task.project.createdById === data.assignedToId ||
                task.project.members.some((member) => member.id === data.assignedToId);

            if (!isNewAssigneeMember) {
                throw new ForbiddenException('New assignee is not a member of this project');
            }
        }

        return this.db.task.update({
            where: { id: taskId },
            data,
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
                        email: true,
                    },
                },
            },
        });
    }

    /**
     * Update task status
     */
    async updateStatus(taskId: string, status: TaskStatus, userId: string, userRole: Role) {
        return this.update(taskId, { status }, userId, userRole);
    }

    /**
     * Delete task (Admin only)
     */
    async delete(taskId: string) {
        const task = await this.db.task.findUnique({
            where: { id: taskId },
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        await this.db.task.delete({
            where: { id: taskId },
        });

        return { message: 'Task deleted successfully' };
    }

    /**
     * Assign task to user
     */
    async assignTask(taskId: string, assignedToId: string, userId: string, userRole: Role) {
        return this.update(taskId, { assignedToId }, userId, userRole);
    }

    /**
     * Unassign task
     */
    async unassignTask(taskId: string, userId: string, userRole: Role) {
        return this.update(taskId, { assignedToId: null }, userId, userRole);
    }

    /**
     * Get tasks by status
     */
    async findByStatus(status: TaskStatus, userId: string, userRole: Role, projectId?: string) {
        let where: any = { status };

        if (projectId) {
            where.projectId = projectId;
        } else if (userRole !== Role.ADMIN) {
            const userProjects = await this.db.project.findMany({
                where: {
                    OR: [{ createdById: userId }, { members: { some: { id: userId } } }],
                },
                select: { id: true },
            });

            where.projectId = { in: userProjects.map((p) => p.id) };
        }

        return this.db.task.findMany({
            where,
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
}
