# Ask Friend Learn Backend

A secure and scalable user management system for an AI tutoring application, built with NestJS, Prisma, and Neon DB.

## Features

- ✅ User registration and login with JWT authentication
- ✅ Password hashing with bcryptjs
- ✅ Chat session CRUD operations with pagination
- ✅ Secure AI integration with Gemini API proxy
- ✅ File upload support (avatars and documents)
- ✅ Email notifications
- ✅ Health checks and monitoring
- ✅ Rate limiting and security
- ✅ Modular architecture with separate modules
- ✅ Comprehensive Swagger API documentation
- ✅ Input validation with class-validator
- ✅ Global error handling and validation pipes
- ✅ API versioning (`/api/v1/`)
- ✅ Security best practices (Bearer auth, input sanitization)
- ✅ Database relationships with Prisma ORM
- ✅ TypeScript for type safety

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure environment**:
   - Update `.env` with your Neon DB URL, JWT secret, and Gemini API key:
   ```env
   DATABASE_URL="your-neon-db-url"
   JWT_SECRET="your-secure-jwt-secret"
   GEMINI_API_KEY="your-gemini-api-key"
   ```

3. **Set up the database**:
   ```bash
   pnpm db:generate
   pnpm db:push
   ```

4. **Run the server**:
   ```bash
   pnpm start:dev
   ```

## API Documentation

Once the server is running, visit `http://localhost:3000/api` to access the Swagger UI for interactive API documentation.

## API Endpoints

### Authentication
- `POST /api/v1/auth/signup`: Register a new user
- `POST /api/v1/auth/login`: Login and get JWT token

### User Management
- `GET /api/v1/users/profile`: Get user profile (requires JWT)

### Chat Sessions
- `POST /api/v1/chat/sessions`: Create a new chat session (requires JWT)
- `GET /api/v1/chat/sessions`: Get paginated list of user chat sessions (requires JWT)
  - Query params: `?page=1&limit=10`
- `GET /api/v1/chat/sessions/:id`: Get a specific chat session (requires JWT)
- `PUT /api/v1/chat/sessions/:id`: Update a chat session (requires JWT)
- `DELETE /api/v1/chat/sessions/:id`: Delete a chat session (requires JWT)
- `GET /api/v1/chat/stats`: Get chat session statistics (requires JWT)

### AI Integration (Secure Proxy)
- `POST /api/v1/ai/generate`: Generate AI response using Gemini API (requires JWT)
  - Body: `{ "message": "Your question here", "systemPrompt": "Optional AI behavior", "parameters": {...} }`
- `POST /api/v1/ai/stream`: Stream AI response in real-time (requires JWT)
  - Body: `{ "message": "Your question here", "systemPrompt": "Optional AI behavior" }`

### File Uploads
- `POST /api/v1/uploads/avatar`: Upload user avatar (requires JWT)
- `POST /api/v1/uploads/document`: Upload document (requires JWT)

### Health & Monitoring
- `GET /api/v1/health`: Application health check
- `GET /api/v1/health/ready`: Readiness check
- `GET /api/v1/health/live`: Liveness check

## AI Integration Setup

### 1. Get Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file:
   ```env
   GEMINI_API_KEY=your-actual-api-key-here
   ```

### 2. Frontend Integration
Instead of calling Gemini API directly from your frontend, use these secure backend endpoints:

```javascript
// Generate complete response
const response = await fetch('/api/v1/ai/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  },
  body: JSON.stringify({
    message: "Explain quantum physics",
    systemPrompt: "You are a helpful physics tutor",
    parameters: { temperature: 0.7, maxTokens: 1000 }
  })
});

// Stream response (Server-Sent Events)
const eventSource = new EventSource('/api/v1/ai/stream', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
});
```

### 3. Security Benefits
- ✅ API key never exposed to frontend
- ✅ Rate limiting and authentication enforced
- ✅ Request/response logging and monitoring
- ✅ Centralized error handling
- ✅ Environment-specific configuration

## Project Structure

```
src/
├── ai/                    # AI integration module
│   ├── dto/              # AI request/response DTOs
│   ├── ai.controller.ts  # AI endpoints
│   ├── ai.service.ts     # Gemini API integration
│   └── ai.module.ts      # AI module configuration
├── auth/                 # Authentication module
├── chat/                 # Chat sessions module
├── common/               # Shared utilities
├── email/                # Email service
├── health/               # Health checks
├── prisma/               # Database module
├── uploads/              # File upload module
├── users/                # User management
├── app.module.ts         # Main application module
└── main.ts              # Application entry point
```

## Environment Variables

```env
DATABASE_URL="postgresql://..."          # Neon DB connection string
JWT_SECRET="your-secure-secret"          # JWT signing secret
GEMINI_API_KEY="your-gemini-api-key"     # Google Gemini API key
APP_URL="http://localhost:3000"          # Application URL
SMTP_HOST="smtp.gmail.com"              # Email SMTP host
SMTP_PORT="587"                         # Email SMTP port
SMTP_USER="your-email@gmail.com"        # Email username
SMTP_PASS="your-app-password"           # Email password
```

## Development

```bash
# Start development server with hot reload
pnpm start:dev

# Build for production
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Format code
pnpm format
```

## Deployment

The application is configured for deployment on Vercel with the included `vercel.json` configuration.

## Security Features

- JWT authentication with Bearer tokens
- Password hashing with bcryptjs
- Input validation and sanitization
- Rate limiting (ThrottlerGuard)
- CORS configuration
- Environment variable protection
- Secure API key handling for AI services
