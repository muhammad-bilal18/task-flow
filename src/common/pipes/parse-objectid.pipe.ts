import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseCuidPipe implements PipeTransform<string> {
    transform(value: string): string {
        // Basic CUID validation (starts with 'c' and has 25 characters)
        if (!value || !value.match(/^c[a-z0-9]{24}$/)) {
            throw new BadRequestException('Invalid ID format');
        }
        return value;
    }
}
