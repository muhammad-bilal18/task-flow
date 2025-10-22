import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as pactum from 'pactum';
import { AppModule } from './../src/app.module';
import { DbService } from 'src/db/db.service';
import { SignUpRequest } from 'src/auth/dto';
import { EditUserRequest } from 'src/user/dto';

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
        await app.listen(3001);
        await db.cleanDb();
        pactum.request.setBaseUrl('http://localhost:3001');
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

        describe('PATCH /users', () => {
            it('should update user with valid access token and all fields', async () => {
                const editUserDto = {
                    firstName: 'Test',
                    lastName: 'User',
                    email: 'test.user@gmail.com',
                };
                await pactum
                    .spec()
                    .patch('/users')
                    .withHeaders({
                        Authorization: 'Bearer $S{userAccessToken}',
                    })
                    .withJson(editUserDto)
                    .expectStatus(200)
                    .expectBodyContains(editUserDto.firstName)
                    .expectBodyContains(editUserDto.lastName)
                    .expectBodyContains(editUserDto.email);
            });

            it('should update user with only firstName', async () => {
                const editUserDto = {
                    firstName: 'UpdatedFirst',
                };
                await pactum
                    .spec()
                    .patch('/users')
                    .withHeaders({
                        Authorization: 'Bearer $S{userAccessToken}',
                    })
                    .withJson(editUserDto)
                    .expectStatus(200)
                    .expectBodyContains(editUserDto.firstName);
            });

            it('should update user with only email', async () => {
                const editUserDto = {
                    email: 'updated.email@gmail.com',
                };
                await pactum
                    .spec()
                    .patch('/users')
                    .withHeaders({
                        Authorization: 'Bearer $S{userAccessToken}',
                    })
                    .withJson(editUserDto)
                    .expectStatus(200)
                    .expectBodyContains(editUserDto.email);
            });

            it('should update user with empty payload', async () => {
                await pactum
                    .spec()
                    .patch('/users')
                    .withHeaders({
                        Authorization: 'Bearer $S{userAccessToken}',
                    })
                    .withJson({})
                    .expectStatus(200);
            });

            it('should fail to update user without access token', async () => {
                const editUserDto = {
                    firstName: 'Test',
                    email: 'test@test.com',
                };
                await pactum.spec().patch('/users').withJson(editUserDto).expectStatus(401);
            });

            it('should fail to update user with invalid email', async () => {
                const editUserDto = {
                    email: 'invalid-email',
                };
                await pactum
                    .spec()
                    .patch('/users')
                    .withHeaders({
                        Authorization: 'Bearer $S{userAccessToken}',
                    })
                    .withJson(editUserDto)
                    .expectStatus(400)
                    .expectBodyContains('email must be an email');
            });

            it('should fail to update user with non-string firstName', async () => {
                const editUserDto = {
                    firstName: 123,
                };
                await pactum
                    .spec()
                    .patch('/users')
                    .withHeaders({
                        Authorization: 'Bearer $S{userAccessToken}',
                    })
                    .withJson(editUserDto)
                    .expectStatus(400)
                    .expectBodyContains('firstName must be a string');
            });

            it('should fail to update user with non-string lastName', async () => {
                const editUserDto = {
                    lastName: 123,
                };
                await pactum
                    .spec()
                    .patch('/users')
                    .withHeaders({
                        Authorization: 'Bearer $S{userAccessToken}',
                    })
                    .withJson(editUserDto)
                    .expectStatus(400)
                    .expectBodyContains('lastName must be a string');
            });

            it('should update user with special characters in names', async () => {
                const editUserDto = {
                    firstName: 'Test-User',
                    lastName: "O'Connor",
                };
                await pactum
                    .spec()
                    .patch('/users')
                    .withHeaders({
                        Authorization: 'Bearer $S{userAccessToken}',
                    })
                    .withJson(editUserDto)
                    .expectStatus(200)
                    .expectBodyContains(editUserDto.firstName)
                    .expectBodyContains(editUserDto.lastName);
            });

            it('should fail to update user with existing email', async () => {
                await pactum
                    .spec()
                    .post('/auth/signup')
                    .withBody({
                        firstName: 'Jane',
                        lastName: 'Doe',
                        email: 'jane.doe1@gmail.com',
                        password: 'changeme',
                    })
                    .expectStatus(201);

                const editUserDto = {
                    email: 'jane.doe1@gmail.com',
                };
                await pactum
                    .spec()
                    .patch('/users')
                    .withHeaders({
                        Authorization: 'Bearer $S{userAccessToken}',
                    })
                    .withJson(editUserDto)
                    .expectStatus(403);
            });
        });
    });
});
