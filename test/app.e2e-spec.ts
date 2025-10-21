import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DbService } from 'src/db/db.service';
import * as pactum from 'pactum';
import { SignUpRequest } from 'src/auth/dto';

describe('AppController (e2e)', () => {
    let app: INestApplication<App>;
    let db: DbService;

    beforeAll(async () => {
        const moduleRef: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();
        db = app.get<DbService>(DbService);
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
            }),
        );
        await app.init();
        await db.cleanDb();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Auth', () => {
        const signupDto: SignUpRequest = {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@gmail.com',
            password: 'changeme',
        };

        describe('Signup', () => {
            it('should signup a new user', async () => {
                return request(app.getHttpServer())
                    .post('/auth/signup')
                    .send(signupDto)
                    .expect(201)
                    .then((res) => {
                        expect(res.body).toHaveProperty('access_token');
                    });
            });

            it('should not signup with existing email', async () => {
                return request(app.getHttpServer())
                    .post('/auth/signup')
                    .send(signupDto)
                    .expect(403);
            });
        });

        describe('Signin', () => {
            it('should signin an existing user', async () => {
                return request(app.getHttpServer())
                    .post('/auth/signin')
                    .send({
                        email: signupDto.email,
                        password: signupDto.password,
                    })
                    .expect(200)
                    .then((res) => {
                        expect(res.body).toHaveProperty('access_token');
                    });
            });

            it('should not signin with wrong credentials', async () => {
                return request(app.getHttpServer())
                    .post('/auth/signin')
                    .send({
                        email: signupDto.email,
                        password: 'wrongpassword',
                    })
                    .expect(403);
            });
        });
    });
});
