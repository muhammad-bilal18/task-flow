import { Injectable } from '@nestjs/common'
import { DbService } from 'src/db/db.service'

@Injectable()
export class AuthService {
    private db: DbService

    signup() { }

    signin() { }
}
