import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as pactum from 'pactum';
import { AppModule } from './../src/app.module';
import { DbService } from 'src/db/db.service';
import { SignUpRequest } from 'src/auth/dto';

describe('AppModule (e2e)', () => {
    let app: INestApplication;
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
        await app.listen(3000);
        await db.cleanDb();
        pactum.request.setBaseUrl('http://localhost:3000');
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Auth API', () => {
        const signupDto: SignUpRequest = {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@gmail.com',
            password: 'changeme',
        };

        describe('POST /auth/signup', () => {
            it('should register a new user successfully', async () => {
                await pactum
                    .spec()
                    .post('/auth/signup')
                    .withJson(signupDto)
                    .expectStatus(201)
                    .expectBodyContains('access_token');
            });

            it('should fail to register with an existing email', async () => {
                await pactum.spec().post('/auth/signup').withJson(signupDto).expectStatus(403);
            });

            it('should fail to register with missing firstName', async () => {
                await pactum
                    .spec()
                    .post('/auth/signup')
                    .withJson({
                        ...signupDto,
                        firstName: '',
                    })
                    .expectStatus(400)
                    .expectBodyContains('firstName should not be empty');
            });

            it('should fail to register with invalid email', async () => {
                await pactum
                    .spec()
                    .post('/auth/signup')
                    .withJson({
                        ...signupDto,
                        email: 'invalid-email',
                    })
                    .expectStatus(400)
                    .expectBodyContains('email must be an email');
            });

            it('should fail to register with missing password', async () => {
                await pactum
                    .spec()
                    .post('/auth/signup')
                    .withJson({
                        ...signupDto,
                        password: '',
                    })
                    .expectStatus(400)
                    .expectBodyContains('password should not be empty');
            });

            it('should fail to register with non-string lastName', async () => {
                await pactum
                    .spec()
                    .post('/auth/signup')
                    .withJson({
                        ...signupDto,
                        lastName: 123,
                    })
                    .expectStatus(400)
                    .expectBodyContains('lastName must be a string');
            });

            it('should register with special characters in names', async () => {
                await pactum
                    .spec()
                    .post('/auth/signup')
                    .withJson({
                        ...signupDto,
                        firstName: 'John-Doe',
                        lastName: "O'Connor",
                        email: 'john.oconnor@gmail.com',
                    })
                    .expectStatus(201)
                    .expectBodyContains('access_token');
            });
        });

        describe('POST /auth/signin', () => {
            it('should sign in an existing user successfully', async () => {
                await pactum
                    .spec()
                    .post('/auth/signin')
                    .withJson({
                        email: signupDto.email,
                        password: signupDto.password,
                    })
                    .expectStatus(200)
                    .expectBodyContains('access_token')
                    .stores('userAccessToken', 'access_token');
            });

            it('should fail to sign in with incorrect credentials', async () => {
                await pactum
                    .spec()
                    .post('/auth/signin')
                    .withJson({
                        email: signupDto.email,
                        password: 'wrongpassword',
                    })
                    .expectStatus(403);
            });

            it('should fail to sign in with missing email', async () => {
                await pactum
                    .spec()
                    .post('/auth/signin')
                    .withJson({
                        email: '',
                        password: signupDto.password,
                    })
                    .expectStatus(400)
                    .expectBodyContains('email should not be empty');
            });

            it('should fail to sign in with invalid email', async () => {
                await pactum
                    .spec()
                    .post('/auth/signin')
                    .withJson({
                        email: 'invalid-email',
                        password: signupDto.password,
                    })
                    .expectStatus(400)
                    .expectBodyContains('email must be an email');
            });

            it('should fail to sign in with missing password', async () => {
                await pactum
                    .spec()
                    .post('/auth/signin')
                    .withJson({
                        email: signupDto.email,
                        password: '',
                    })
                    .expectStatus(400)
                    .expectBodyContains('password should not be empty');
            });
        });
    });

    describe('User API', () => {
        describe('GET /users/me', () => {
            it('should retrieve current user with valid access token', async () => {
                await pactum
                    .spec()
                    .get('/users/me')
                    .withHeaders({
                        Authorization: 'Bearer $S{userAccessToken}',
                    })
                    .expectStatus(200)
                    .expectBodyContains('user');
            });

            it('should fail to retrieve current user without access token', async () => {
                await pactum
                    .spec()
                    .get('/users/me')
                    .withHeaders({ Authorization: '' })
                    .expectStatus(401);
            });
        });
    });
});
