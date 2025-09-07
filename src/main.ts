import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe with enhanced options
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Strip properties that do not have decorators
    forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are provided
    transform: true, // Transform payload to DTO instances
    disableErrorMessages: process.env.NODE_ENV === 'production', // Hide error messages in production
  }));

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Ask Friend Learn Backend')
    .setDescription('API for AI tutoring application with user management')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('chat', 'Chat session management endpoints')
    .addTag('health', 'Health check endpoints')
    .addTag('uploads', 'File upload endpoints')
    .addServer('http://localhost:3000', 'Development server')
    .addServer('https://study-buddy-backend-black.vercel.app', 'Production server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // API versioning
  app.setGlobalPrefix('api/v1');

  await app.listen(3000);
  console.log(`🚀 Server running on: http://localhost:3000`);
  console.log(`📚 API Documentation: http://localhost:3000/api`);
  console.log(`❤️  Health Check: http://localhost:3000/api/v1/health`);
}
bootstrap();
