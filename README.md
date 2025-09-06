# As## Features

- ✅ User registration and login with JWT authentication
- ✅ Password hashing with bcryptjs
- ✅ Chat session CRUD operations with pagination
- ✅ Modular architecture with separate Auth, Users, and Chat modules
- ✅ Comprehensive Swagger API documentation
- ✅ Input validation with class-validator
- ✅ Global error handling and validation pipes
- ✅ API versioning (`/api/v1/`)
- ✅ Security best practices (Bearer auth, input sanitization)
- ✅ Database relationships with Prisma ORM
- ✅ TypeScript for type safety

## Recent Improvements

### 🔒 Security & Validation
- Global validation pipes with strict mode
- Enhanced error handling
- Input sanitization and validation
- API versioning for future compatibility

### 📊 Performance & Scalability
- Pagination for chat sessions (page/limit query params)
- Optimized database queries
- Proper indexing with UUID primary keys
- Connection pooling via Prisma

### 📚 Documentation & DX
- Comprehensive Swagger documentation
- Interactive API testing
- Detailed response schemas
- Bearer token authentication in docs

### 🛠️ Developer Experience
- Hot reload in development
- TypeScript strict mode
- Modular architecture
- Clean separation of concernsd Learn Backend

A secure and scalable user management system for an AI tutoring application, built with NestJS, Prisma, and Neon DB.

## Features

- User registration and login with JWT authentication
- Password hashing with bcryptjs
- Chat session storage linked to users
- Modular architecture with separate Auth, Users, and Prisma modules
- Swagger API documentation

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure environment**:
   - Update `.env` with your Neon DB URL and a secure JWT secret.

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
- `POST /api/v1/auth/login`: Login and get JWT

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

## Project Structure

- `src/auth/`: Authentication module
- `src/users/`: Users module
- `src/chat/`: Chat sessions module
- `src/prisma/`: Prisma module
- `prisma/schema.prisma`: Database schema
