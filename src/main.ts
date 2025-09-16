import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
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
      origin: '*',
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
      .addTag('learning-plans', 'Learning plans and milestones management')
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
    SwaggerModule.setup('api/docs', app, document);

    // API versioning
    app.setGlobalPrefix('api');

    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`🚀 Server running on: http://localhost:${port}`);
    console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
    console.log(`❤️  Health Check: http://localhost:${port}/api/health`);
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}
bootstrap();
