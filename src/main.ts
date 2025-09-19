import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

let app;

async function bootstrap() {
  try {
    if (!app) {
      app = await NestFactory.create(AppModule);

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

      // Swagger configuration - only enable in development
      if (process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production') {
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

        console.log('✅ Swagger UI enabled at /api/docs');
      } else {
        // In production, still create the document for JSON endpoint
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

        // Add JSON endpoint for API documentation
        app.getHttpAdapter().getInstance().get('/api/docs-json', (req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.send(document);
        });

        console.log('ℹ️ Swagger UI disabled in production environment');
        console.log('ℹ️ API documentation available at /api/docs-json');
      }

      // API versioning
      app.setGlobalPrefix('api');

      await app.init();
    }

    return app;
  } catch (error) {
    console.error('❌ Error starting server:', error);
    throw error;
  }
}

// Export for Vercel
export default async function handler(req, res) {
  const app = await bootstrap();
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp(req, res);
}
