import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator"
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
}

export class SignInRequest {
    @IsEmail()
    @IsNotEmpty()
    email: string

    @IsString()
    @IsNotEmpty()
    password: string
}
