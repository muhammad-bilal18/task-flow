import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DbService } from 'src/db/db.service';

@Injectable()
export class CommentService {
    @Inject(DbService)
    private db: DbService;

    /**
     * Create a comment on a task
     */
    async create(
        data: {
            content: string;
            taskId: string;
        },
        authorId: string,
        userRole: Role,
    ) {
        // Verify task exists
        const task = await this.db.task.findUnique({
            where: { id: data.taskId },
            include: {
                project: {
                    include: { members: true },
                },
            },
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        // Check if user has access to the task's project
        const hasAccess =
            userRole === Role.ADMIN ||
            task.project.createdById === authorId ||
            task.project.members.some((member) => member.id === authorId);

        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this task');
        }

        return this.db.comment.create({
            data: {
                content: data.content,
                taskId: data.taskId,
                authorId,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                task: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        });
    }

    /**
     * Get all comments for a task
     */
    async findByTask(taskId: string, userId: string, userRole: Role) {
        // Verify task exists and user has access
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

        const hasAccess =
            userRole === Role.ADMIN ||
            task.project.createdById === userId ||
            task.project.members.some((member) => member.id === userId);

        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this task');
        }

        return this.db.comment.findMany({
            where: { taskId },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    /**
     * Get comment by ID
     */
    async findById(commentId: string, userId: string, userRole: Role) {
        const comment = await this.db.comment.findUnique({
            where: { id: commentId },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                task: {
                    include: {
                        project: {
                            include: { members: true },
                        },
                    },
                },
            },
        });

        if (!comment) {
            throw new NotFoundException('Comment not found');
        }

        // Check access
        const hasAccess =
            userRole === Role.ADMIN ||
            comment.task.project.createdById === userId ||
            comment.task.project.members.some((member) => member.id === userId);

        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this comment');
        }

        return comment;
    }

    /**
     * Update comment (author only)
     */
    async update(commentId: string, content: string, userId: string, userRole: Role) {
        const comment = await this.db.comment.findUnique({
            where: { id: commentId },
        });

        if (!comment) {
            throw new NotFoundException('Comment not found');
        }

        // Only author can update their own comment
        if (comment.authorId !== userId && userRole !== Role.ADMIN) {
            throw new ForbiddenException('You can only update your own comments');
        }

        return this.db.comment.update({
            where: { id: commentId },
            data: { content },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                task: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        });
    }

    /**
     * Delete comment (author or admin)
     */
    async delete(commentId: string, userId: string, userRole: Role) {
        const comment = await this.db.comment.findUnique({
            where: { id: commentId },
        });

        if (!comment) {
            throw new NotFoundException('Comment not found');
        }

        // Author can delete their own comment, Admin can delete any comment
        if (comment.authorId !== userId && userRole !== Role.ADMIN) {
            throw new ForbiddenException(
                'You can only delete your own comments or must be an admin',
            );
        }

        await this.db.comment.delete({
            where: { id: commentId },
        });

        return { message: 'Comment deleted successfully' };
    }

    /**
     * Get all comments by a user
     */
    async findByUser(targetUserId: string, requestingUserId: string, userRole: Role) {
        // Users can view their own comments, admins can view anyone's
        if (targetUserId !== requestingUserId && userRole !== Role.ADMIN) {
            throw new ForbiddenException('You can only view your own comments');
        }

        return this.db.comment.findMany({
            where: { authorId: targetUserId },
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        project: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
