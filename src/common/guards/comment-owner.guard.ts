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
export class CommentOwnerGuard implements CanActivate {
    @Inject(DbService)
    private db: DbService;

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const commentId = request.params.commentId || request.params.id;

        if (!commentId) {
            throw new ForbiddenException('Comment ID is required');
        }

        // Admin can modify any comment
        if (user.role === Role.ADMIN) {
            return true;
        }

        // Check if user is the comment author
        const comment = await this.db.comment.findUnique({
            where: { id: commentId },
        });

        if (!comment) {
            throw new NotFoundException('Comment not found');
        }

        if (comment.authorId !== user.id) {
            throw new ForbiddenException('You can only modify your own comments');
        }

        return true;
    }
}
