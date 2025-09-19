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

      // API versioning - set prefix before creating Swagger docs so the OpenAPI spec contains the prefix
      app.setGlobalPrefix('api');

      // Swagger configuration - only enable in development
      if (process.env.NODE_ENV == 'production' && process.env.VERCEL_ENV == 'production') {
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

        // In production (serverless) environments some Swagger static assets may 404
        // because the Nest SwaggerModule serves them from disk. Redirect common
        // asset paths to the official CDN so the UI loads correctly on Vercel.
        if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
          const expressApp = app.getHttpAdapter().getInstance();
          const cdnBase = 'https://unpkg.com/swagger-ui-dist@4.18.3';
          const assets = [
            'swagger-ui.css',
            'swagger-ui-bundle.js',
            'swagger-ui-standalone-preset.js',
            'favicon-32x32.png',
            'favicon-16x16.png',
          ];
          assets.forEach((name) => {
            expressApp.get(`/api/docs/${name}`, (req, res) => {
              res.redirect(`${cdnBase}/${name}`);
            });
          });
        }

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

// Start server for local development
if (require.main === module) {
  bootstrap()
    .then((app) => {
      const port = process.env.PORT || 3000;
      return app.listen(port, '0.0.0.0');
    })
    .then(() => {
      console.log('🚀 Server started successfully!');
      console.log(`📍 Local server: http://localhost:${process.env.PORT || 3000}`);
      console.log(`📖 API endpoints: http://localhost:${process.env.PORT || 3000}/api`);
      if (process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production') {
        console.log(`📚 Swagger UI: http://localhost:${process.env.PORT || 3000}/api/docs`);
      } else {
        console.log(`📄 API Docs JSON: http://localhost:${process.env.PORT || 3000}/api/docs-json`);
      }
    })
    .catch((error) => {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    });
}
