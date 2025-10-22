import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DbService } from 'src/db/db.service';

@Injectable()
export class ProjectService {
    @Inject(DbService)
    private db: DbService;

    /**
     * Create a new project (Admin only)
     */
    async create(
        data: {
            name: string;
            description?: string;
            memberIds?: string[];
        },
        createdById: string,
    ) {
        return this.db.project.create({
            data: {
                name: data.name,
                description: data.description,
                createdById,
                members: data.memberIds
                    ? {
                          connect: data.memberIds.map((id) => ({ id })),
                      }
                    : undefined,
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
                members: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                _count: {
                    select: {
                        tasks: true,
                    },
                },
            },
        });
    }

    /**
     * Get all projects (Admin sees all, Members see only their projects)
     */
    async findAll(userId: string, userRole: Role) {
        const where =
            userRole === Role.ADMIN
                ? {}
                : {
                      OR: [{ createdById: userId }, { members: { some: { id: userId } } }],
                  };

        return this.db.project.findMany({
            where,
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                members: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                _count: {
                    select: {
                        tasks: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get project by ID
     */
    async findById(projectId: string, userId: string, userRole: Role) {
        const project = await this.db.project.findUnique({
            where: { id: projectId },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                members: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        role: true,
                    },
                },
                tasks: {
                    include: {
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
                },
            },
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        // Check access permission
        const hasAccess =
            userRole === Role.ADMIN ||
            project.createdById === userId ||
            project.members.some((member) => member.id === userId);

        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this project');
        }

        return project;
    }

    /**
     * Update project (Admin only)
     */
    async update(
        projectId: string,
        data: {
            name?: string;
            description?: string;
        },
    ) {
        const project = await this.db.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        return this.db.project.update({
            where: { id: projectId },
            data,
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                members: {
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
     * Delete project (Admin only)
     */
    async delete(projectId: string) {
        const project = await this.db.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        await this.db.project.delete({
            where: { id: projectId },
        });

        return { message: 'Project deleted successfully' };
    }

    /**
     * Add members to project (Admin only)
     */
    async addMembers(projectId: string, memberIds: string[]) {
        const project = await this.db.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        // Verify all users exist
        const users = await this.db.user.findMany({
            where: { id: { in: memberIds } },
        });

        if (users.length !== memberIds.length) {
            throw new NotFoundException('One or more users not found');
        }

        return this.db.project.update({
            where: { id: projectId },
            data: {
                members: {
                    connect: memberIds.map((id) => ({ id })),
                },
            },
            include: {
                members: {
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
     * Remove members from project (Admin only)
     */
    async removeMembers(projectId: string, memberIds: string[]) {
        const project = await this.db.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        return this.db.project.update({
            where: { id: projectId },
            data: {
                members: {
                    disconnect: memberIds.map((id) => ({ id })),
                },
            },
            include: {
                members: {
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
     * Get project members
     */
    async getMembers(projectId: string, userId: string, userRole: Role) {
        const project = await this.db.project.findUnique({
            where: { id: projectId },
            include: {
                members: true,
            },
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        // Check access
        const hasAccess =
            userRole === Role.ADMIN ||
            project.createdById === userId ||
            project.members.some((member) => member.id === userId);

        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this project');
        }

        return project.members.map((member) => ({
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
            role: member.role,
        }));
    }

    /**
     * Get project statistics
     */
    async getProjectStats(projectId: string, userId: string, userRole: Role) {
        const project = await this.db.project.findUnique({
            where: { id: projectId },
            include: {
                members: true,
                tasks: true,
            },
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        // Check access
        const hasAccess =
            userRole === Role.ADMIN ||
            project.createdById === userId ||
            project.members.some((member) => member.id === userId);

        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this project');
        }

        const taskStats = await this.db.task.groupBy({
            by: ['status'],
            where: { projectId },
            _count: true,
        });

        return {
            projectId: project.id,
            name: project.name,
            totalMembers: project.members.length,
            totalTasks: project.tasks.length,
            tasksByStatus: taskStats.reduce(
                (acc, stat) => {
                    acc[stat.status] = stat._count;
                    return acc;
                },
                {} as Record<string, number>,
            ),
            createdAt: project.createdAt,
        };
    }
}
