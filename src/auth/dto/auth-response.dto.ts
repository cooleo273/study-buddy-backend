    import { ApiProperty } from '@nestjs/swagger';

    /**
     * Standardized minimal DTO for returning user information from auth endpoints
     */
    export class AuthUserResponseDto {
    @ApiProperty({
        description: 'Unique user identifier',
        example: 'b6e11e23-d43d-4a0d-a9d3-08e94d7a032b',
    })
    id: string;

    @ApiProperty({
        description: 'Email address',
        example: 'user@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'Full name of the user',
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: 'Whether the user account is active',
        example: true,
        required: false,
    })
    isActive?: boolean;

    @ApiProperty({
        description: 'User role',
        example: 'user',
        enum: ['user', 'admin'],
    })
    role: string;
    }

    /**
     * DTO for returning JWT authentication response
     */
    export class JwtAuthResponseDto {
    @ApiProperty({
        description: 'JWT access token for authentication',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    accessToken: string;

    @ApiProperty({
        description: 'JWT refresh token for obtaining new access tokens',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    refreshToken: string;

    @ApiProperty({
        description: 'User information',
        type: AuthUserResponseDto,
    })
    user: AuthUserResponseDto;
    }