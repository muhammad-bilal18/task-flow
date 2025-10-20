import { IsEmail, IsEnum, IsNotEmpty, IsString } from "class-validator"
import { Role } from "generated/prisma"

export class SignUpRequest {
    @IsString()
    @IsNotEmpty()
    firstName: string

    @IsString()
    @IsNotEmpty()
    lastName: string

    @IsEmail()
    @IsNotEmpty()
    email: string

    @IsString()
    @IsNotEmpty()
    password: string

    @IsEnum(Role)
    role?: Role
}

export class SignInRequest {
    @IsEmail()
    @IsNotEmpty()
    email: string

    @IsString()
    @IsNotEmpty()
    password: string
}
