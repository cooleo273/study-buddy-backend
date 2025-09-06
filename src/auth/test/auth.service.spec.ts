import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              create: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    it('should create a new user', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        createdAt: new Date(),
      };

      jest.spyOn(prismaService.user, 'create').mockResolvedValue(mockUser as any);

      const result = await service.signUp({
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
      });

      expect(result).toEqual(mockUser);
      expect(prismaService.user.create).toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('should return access token for valid credentials', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        hashedPassword: 'hashedpassword',
      };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mocktoken');

      const result = await service.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({ access_token: 'mocktoken' });
    });
  });
});
