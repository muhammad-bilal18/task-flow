import { Inject, Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { DbService } from 'src/db/db.service';

@Injectable()
export class AnalyticsService {
    @Inject(DbService)
    private db: DbService;

    /**
     * Get overall system statistics (Admin only)
     */
    async getSystemStats() {
        const [
            totalUsers,
            totalProjects,
            totalTasks,
            totalComments,
            tasksByStatus,
            recentActivity,
        ] = await Promise.all([
            this.db.user.count(),
            this.db.project.count(),
            this.db.task.count(),
            this.db.comment.count(),
            this.db.task.groupBy({
                by: ['status'],
                _count: true,
            }),
            this.getRecentActivity(),
        ]);

        const completedTasks =
            tasksByStatus.find((item) => item.status === TaskStatus.DONE)?._count || 0;
        const inProgressTasks =
            tasksByStatus.find((item) => item.status === TaskStatus.IN_PROGRESS)?._count || 0;
        const todoTasks =
            tasksByStatus.find((item) => item.status === TaskStatus.TODO)?._count || 0;

        return {
            overview: {
                totalUsers,
                totalProjects,
                totalTasks,
                totalComments,
            },
            tasks: {
                total: totalTasks,
                completed: completedTasks,
                inProgress: inProgressTasks,
                todo: todoTasks,
                completionRate:
                    totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0,
            },
            recentActivity,
        };
    }

    /**
     * Get project-specific analytics
     */
    async getProjectAnalytics(projectId: string) {
        const project = await this.db.project.findUnique({
            where: { id: projectId },
            include: {
                members: true,
                tasks: {
                    include: {
                        comments: true,
                        assignedTo: true,
                    },
                },
            },
        });

        if (!project) {
            throw new Error('Project not found');
        }

        const tasksByStatus = project.tasks.reduce(
            (acc, task) => {
                acc[task.status] = (acc[task.status] || 0) + 1;
                return acc;
            },
            {} as Record<TaskStatus, number>,
        );

        const totalComments = project.tasks.reduce((sum, task) => sum + task.comments.length, 0);

        const assignedTasks = project.tasks.filter((task) => task.assignedToId).length;
        const unassignedTasks = project.tasks.length - assignedTasks;

        // Task distribution by member
        const tasksByMember = project.tasks.reduce(
            (acc, task) => {
                if (task.assignedTo) {
                    const memberName = `${task.assignedTo.firstName} ${task.assignedTo.lastName}`;
                    acc[memberName] = (acc[memberName] || 0) + 1;
                }
                return acc;
            },
            {} as Record<string, number>,
        );

        return {
            projectId: project.id,
            projectName: project.name,
            totalMembers: project.members.length,
            tasks: {
                total: project.tasks.length,
                byStatus: tasksByStatus,
                assigned: assignedTasks,
                unassigned: unassignedTasks,
            },
            taskDistribution: tasksByMember,
            totalComments,
            createdAt: project.createdAt,
        };
    }

    /**
     * Get user-specific analytics
     */
    async getUserAnalytics(userId: string) {
        const [user, projectsCreated, projectsMemberOf, tasks, comments] = await Promise.all([
            this.db.user.findUnique({
                where: { id: userId },
            }),
            this.db.project.count({
                where: { createdById: userId },
            }),
            this.db.project.count({
                where: { members: { some: { id: userId } } },
            }),
            this.db.task.findMany({
                where: { assignedToId: userId },
                include: {
                    project: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            this.db.comment.count({
                where: { authorId: userId },
            }),
        ]);

        if (!user) {
            throw new Error('User not found');
        }

        const tasksByStatus = tasks.reduce(
            (acc, task) => {
                acc[task.status] = (acc[task.status] || 0) + 1;
                return acc;
            },
            {} as Record<TaskStatus, number>,
        );

        const tasksByProject = tasks.reduce(
            (acc, task) => {
                acc[task.project.name] = (acc[task.project.name] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>,
        );

        return {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role,
            projects: {
                created: projectsCreated,
                memberOf: projectsMemberOf,
                total: projectsCreated + projectsMemberOf,
            },
            tasks: {
                total: tasks.length,
                byStatus: tasksByStatus,
                byProject: tasksByProject,
            },
            totalComments: comments,
            memberSince: user.createdAt,
        };
    }

    /**
     * Get active users per project
     */
    async getActiveUsersPerProject() {
        const projects = await this.db.project.findMany({
            include: {
                members: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                _count: {
                    select: {
                        tasks: true,
                    },
                },
            },
        });

        return projects.map((project) => ({
            projectId: project.id,
            projectName: project.name,
            activeMembers: project.members.length,
            totalTasks: project._count.tasks,
            members: project.members,
        }));
    }

    /**
     * Get completion rate by project
     */
    async getCompletionRateByProject() {
        const projects = await this.db.project.findMany({
            include: {
                tasks: true,
            },
        });

        return projects.map((project) => {
            const totalTasks = project.tasks.length;
            const completedTasks = project.tasks.filter(
                (task) => task.status === TaskStatus.DONE,
            ).length;

            return {
                projectId: project.id,
                projectName: project.name,
                totalTasks,
                completedTasks,
                completionRate:
                    totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0,
            };
        });
    }

    /**
     * Get recent activity across the system
     */
    async getRecentActivity(limit: number = 10) {
        const [recentTasks, recentComments, recentProjects] = await Promise.all([
            this.db.task.findMany({
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    project: {
                        select: {
                            name: true,
                        },
                    },
                    assignedTo: {
                        select: {
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            }),
            this.db.comment.findMany({
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    author: {
                        select: {
                            firstName: true,
                            lastName: true,
                        },
                    },
                    task: {
                        select: {
                            title: true,
                        },
                    },
                },
            }),
            this.db.project.findMany({
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    createdBy: {
                        select: {
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            }),
        ]);

        return {
            recentTasks: recentTasks.map((task) => ({
                id: task.id,
                title: task.title,
                status: task.status,
                project: task.project.name,
                assignedTo: task.assignedTo
                    ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                    : 'Unassigned',
                createdAt: task.createdAt,
            })),
            recentComments: recentComments.map((comment) => ({
                id: comment.id,
                content:
                    comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
                author: `${comment.author.firstName} ${comment.author.lastName}`,
                task: comment.task.title,
                createdAt: comment.createdAt,
            })),
            recentProjects: recentProjects.map((project) => ({
                id: project.id,
                name: project.name,
                createdBy: `${project.createdBy.firstName} ${project.createdBy.lastName}`,
                createdAt: project.createdAt,
            })),
        };
    }

    /**
     * Get task trend over time (last 30 days)
     */
    async getTaskTrend() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const tasks = await this.db.task.findMany({
            where: {
                createdAt: {
                    gte: thirtyDaysAgo,
                },
            },
            select: {
                createdAt: true,
                status: true,
            },
        });

        // Group by date
        const tasksByDate = tasks.reduce(
            (acc, task) => {
                const date = task.createdAt.toISOString().split('T')[0];
                if (!acc[date]) {
                    acc[date] = { created: 0, completed: 0 };
                }
                acc[date].created += 1;
                if (task.status === TaskStatus.DONE) {
                    acc[date].completed += 1;
                }
                return acc;
            },
            {} as Record<string, { created: number; completed: number }>,
        );

        return Object.entries(tasksByDate).map(([date, data]) => ({
            date,
            tasksCreated: data.created,
            tasksCompleted: data.completed,
        }));
    }

    /**
     * Get productivity report for a specific time period
     */
    async getProductivityReport(startDate: Date, endDate: Date) {
        const tasks = await this.db.task.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                project: {
                    select: {
                        name: true,
                    },
                },
                assignedTo: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        const completedTasks = tasks.filter((task) => task.status === TaskStatus.DONE);

        return {
            period: {
                start: startDate,
                end: endDate,
            },
            totalTasksCreated: tasks.length,
            totalTasksCompleted: completedTasks.length,
            completionRate:
                tasks.length > 0 ? ((completedTasks.length / tasks.length) * 100).toFixed(2) : 0,
            tasksByProject: tasks.reduce(
                (acc, task) => {
                    const projectName = task.project.name;
                    if (!acc[projectName]) {
                        acc[projectName] = { total: 0, completed: 0 };
                    }
                    acc[projectName].total += 1;
                    if (task.status === TaskStatus.DONE) {
                        acc[projectName].completed += 1;
                    }
                    return acc;
                },
                {} as Record<string, { total: number; completed: number }>,
            ),
        };
    }
}
