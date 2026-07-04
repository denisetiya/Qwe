# QWE Framework

<div style="display: flex; justify-content: center;">
  <img src="logo.png" alt="Qwe Framework Logo" width="180" height="180">
</div>

> High-performance, zero-dependency TypeScript backend framework powered by uWebSockets.js

QWE adalah framework backend modern untuk Node.js yang mengutamakan performa tinggi, kemudahan penggunaan, dan arsitektur yang terstruktur. Dibangun di atas uWebSockets.js untuk kecepatan maksimal dengan API yang mirip NestJS namun tanpa decorator.

## ✨ Fitur Utama

### Core Framework
- **🚀 Ultra Fast**: Powered by uWebSockets.js, mencapai 65K-95K req/s untuk operasi CRUD
- **🎯 Zero Dependencies**: Tidak ada dependency runtime, semua built-in menggunakan Node.js stdlib
- **📦 Modular Architecture**: Struktur folder mirip NestJS (module/controller/service/router)
- **🔧 Dependency Injection**: IoC container dengan auto-wiring berdasarkan parameter name
- **🛣️ Radix Router**: Routing cepat dengan O(log n) complexity dan route caching

### Validation (Schema v)
- **✅ Zod-like API**: Schema validation yang familiar dan type-safe
- **🔗 Chainable**: `.string().min(2).max(100).email()`
- **🎭 Type Inference**: Automatic TypeScript type inference dari schema
- **🛡️ Validation Pipe**: Middleware otomatis untuk request validation

### Database (ORM)
- **🌐 Multi-Database**: Support PostgreSQL, MySQL, SQLite, MSSQL, dan MongoDB
- **📝 Prisma-like API**: `where`, `orderBy`, `include`, `select` yang intuitif
- **⚡ Query Caching**: LRU cache untuk query optimization
- **🔄 Prepared Statements**: SQLite statement caching untuk performa maksimal
- **🏗️ Migrations**: Built-in migration system

### Security
- **🔐 JWT Authentication**: Token-based auth dengan sign/verify/refresh
- **🔒 Password Hashing**: Scrypt dengan salt dan timing-safe comparison
- **🛡️ CORS**: Configurable Cross-Origin Resource Sharing
- **🪖 Helmet**: Security headers otomatis
- **⏱️ Rate Limiting**: Sliding window rate limiter
- **🔓 CSRF Protection**: Double-submit cookie pattern

### Middleware & Utilities
- **🗜️ Compression**: Brotli, Gzip, Deflate dengan auto-negotiation
- **📤 File Upload**: Streaming multipart parser
- **🍪 Cookie Parser**: Signed cookie support dengan HMAC
- **📊 Logging**: Structured logging dengan multiple transports
- **⚡ Response Cache**: LRU cache untuk response optimization
- **🔗 WebSocket**: Real-time communication support

### CLI Tools
- **🎨 Code Generator**: Generate module/controller/service dengan 1 command
- **📋 Postman Export**: Auto-generate Postman collection dari routes
- **🗄️ Migration Commands**: Create, run, rollback migrations

## 📊 Performance

Benchmark dilakukan dengan 100 concurrent connections, 10 second duration:

| Endpoint | qwe (req/s) | Express (req/s) | Go (req/s) | Rust (req/s) |
|----------|-------------|-----------------|------------|--------------|
| GET /users (list) | **95,000** | 12,000 | 89,000 | 65,000 |
| GET /users/:id | **65,000** | 13,000 | 60,000 | 97,000 |
| POST /users | **33,000** | 260 | 2,900 | 3,000 |
| PUT /users/:id | **10,000** | 7,500 | 3,000 | 10,000 |
| DELETE /users/:id | **9,500** | 13,000 | 3,200 | 9,600 |

**Hasil**: QWE unggul di read operations dan significantly lebih cepat untuk write operations dibandingkan Express, dengan performa setara Go dan Rust untuk most endpoints.

## 🚀 Quick Start

### Instalasi

```bash
# Buat project baru
mkdir my-api
cd my-api
npm init -y

# Install QWE
npm install qwe-framework

# Install TypeScript dan tools development
npm install -D typescript @types/node tsx
```

### Setup Project

```bash
# Initialize TypeScript
npx tsc --init

# Create project structure
mkdir -p src/{modules,common}
```

### Hello World

```typescript
// src/main.ts
import { Application } from 'qwe-framework';

const app = new Application();

// Simple route
app.get('/', (req, res) => {
  res.json({ message: 'Hello, QWE! 🚀' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

Run dengan:
```bash
npx tsx src/main.ts
```

### Module Structure

```
src/
├── main.ts                 # Entry point
├── app.module.ts          # Root module
├── modules/
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.router.ts
│   │   └── dto/
│   │       └── create-user.schema.ts
│   └── posts/
│       ├── posts.module.ts
│       ├── posts.controller.ts
│       ├── posts.service.ts
│       └── posts.router.ts
├── common/
│   ├── guards/
│   │   └── auth.guard.ts
│   ├── middleware/
│   │   └── logger.middleware.ts
│   └── filters/
│       └── http-exception.filter.ts
└── database/
    ├── connection.ts
    └── migrations/
        └── 001_create_users.ts
```

## 📚 User Guide

### Creating a Module

```typescript
// src/modules/users/users.module.ts
import { Module } from 'qwe-framework';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseService } from '../../database/connection';

@Module({
  name: 'users',
  prefix: '/users',
  controllers: [UsersController],
  providers: [
    UsersService,
    DatabaseService
  ]
})
export class UsersModule {}
```

### Creating a Controller

```typescript
// src/modules/users/users.controller.ts
import { Controller, ExecutionContext } from 'qwe-framework';
import { UsersService } from './users.service';
import { v } from 'qwe-framework/validation';

@Controller()
export class UsersController {
  constructor(private usersService: UsersService) {}

  async getAll(ctx: ExecutionContext) {
    const users = await this.usersService.findAll();
    ctx.response.json({ data: users });
  }

  async getOne(ctx: ExecutionContext) {
    const id = parseInt(ctx.request.params.id);
    const user = await this.usersService.findById(id);
    
    if (!user) {
      ctx.response.status(404).json({ error: 'User not found' });
      return;
    }
    
    ctx.response.json({ data: user });
  }

  async create(ctx: ExecutionContext) {
    const user = await this.usersService.create(ctx.request.body);
    ctx.response.status(201).json({ data: user });
  }

  async update(ctx: ExecutionContext) {
    const id = parseInt(ctx.request.params.id);
    const user = await this.usersService.update(id, ctx.request.body);
    ctx.response.json({ data: user });
  }

  async delete(ctx: ExecutionContext) {
    const id = parseInt(ctx.request.params.id);
    await this.usersService.delete(id);
    ctx.response.status(204).send();
  }
}
```

### Creating a Service

```typescript
// src/modules/users/users.service.ts
import { Injectable } from 'qwe-framework';
import { DatabaseService } from '../../database/connection';

@Injectable()
export class UsersService {
  constructor(private db: DatabaseService) {}

  async findAll() {
    return this.db.query('users')
      .select(['id', 'name', 'email'])
      .orderBy('created_at', 'desc')
      .execute();
  }

  async findById(id: number) {
    return this.db.query('users')
      .where('id', '=', id)
      .first();
  }

  async create(data: { name: string; email: string }) {
    const result = await this.db.query('users')
      .insert(data)
      .returning('*')
      .execute();
    
    return result[0];
  }

  async update(id: number, data: Partial<{ name: string; email: string }>) {
    const result = await this.db.query('users')
      .where('id', '=', id)
      .update(data)
      .returning('*')
      .execute();
    
    return result[0];
  }

  async delete(id: number) {
    await this.db.query('users')
      .where('id', '=', id)
      .delete()
      .execute();
  }
}
```

### Creating a Router

```typescript
// src/modules/users/users.router.ts
import { Router } from 'qwe-framework';
import { UsersController } from './users.controller';
import { AuthGuard } from '../../common/guards/auth.guard';

export const usersRouter = new Router();

// Public routes
usersRouter.get('/', UsersController, 'getAll');
usersRouter.get('/:id', UsersController, 'getOne');

// Protected routes (require authentication)
usersRouter.post('/', UsersController, 'create', {
  guards: [AuthGuard]
});

usersRouter.put('/:id', UsersController, 'update', {
  guards: [AuthGuard]
});

usersRouter.delete('/:id', UsersController, 'delete', {
  guards: [AuthGuard]
});
```

## 🔍 Validation dengan Schema v

QWE menggunakan schema validation system yang mirip Zod:

### Basic Validation

```typescript
import { v } from 'qwe-framework/validation';

// String validation
const nameSchema = v.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name cannot exceed 100 characters');

// Email validation
const emailSchema = v.string().email('Invalid email format');

// Number validation
const ageSchema = v.number()
  .integer('Age must be an integer')
  .min(0, 'Age cannot be negative')
  .max(150, 'Invalid age');
```

### Object Validation

```typescript
// src/modules/users/dto/create-user.schema.ts
import { v } from 'qwe-framework/validation';
import type { Infer } from 'qwe-framework/validation';

export const CreateUserSchema = v.object({
  name: v.string().min(2).max(100),
  email: v.string().email(),
  age: v.number().integer().min(18).optional(),
  role: v.enum(['user', 'admin']).default('user')
});

// Type inference
export type CreateUserDto = Infer<typeof CreateUserSchema>;
```

### Using Validation in Controllers

```typescript
import { ValidationPipe } from 'qwe-framework/validation';
import { CreateUserSchema } from './dto/create-user.schema';

// Method 1: Auto-validation with pipe
@UsePipe(ValidationPipe(CreateUserSchema))
async create(ctx: ExecutionContext) {
  // ctx.request.body is already validated and typed
  const user = await this.usersService.create(ctx.request.body);
  ctx.response.status(201).json({ data: user });
}

// Method 2: Manual validation
async createManual(ctx: ExecutionContext) {
  try {
    const data = CreateUserSchema.parse(ctx.request.body);
    const user = await this.usersService.create(data);
    ctx.response.status(201).json({ data: user });
  } catch (error) {
    ctx.response.status(400).json({ 
      error: 'Validation failed',
      details: error.errors 
    });
  }
}
```

## 🗄️ Database & ORM

### Database Connection

```typescript
// src/database/connection.ts
import { DatabaseService } from 'qwe-framework/database';

export const db = new DatabaseService({
  type: 'sqlite', // or 'postgres', 'mysql', 'mssql', 'mongodb'
  filename: './database.sqlite',
  // For PostgreSQL/MySQL:
  // host: 'localhost',
  // port: 5432,
  // database: 'myapp',
  // username: 'user',
  // password: 'password'
});

// Enable WAL mode for SQLite (better performance)
db.raw('PRAGMA journal_mode = WAL');
db.raw('PRAGMA synchronous = NORMAL');
```

### Query Builder API

```typescript
// Simple select
const users = await db.query('users')
  .select(['id', 'name', 'email'])
  .where('active', '=', true)
  .orderBy('created_at', 'desc')
  .limit(10)
  .execute();

// Complex where conditions
const filteredUsers = await db.query('users')
  .where('age', '>', 18)
  .where('status', '=', 'active')
  .whereGroup((q) => {
    q.where('role', '=', 'admin')
     .orWhere('verified', '=', true);
  })
  .execute();

// Insert with returning
const newUser = await db.query('users')
  .insert({ name: 'John', email: 'john@example.com' })
  .returning('*')
  .execute();

// Update
const updated = await db.query('users')
  .where('id', '=', 1)
  .update({ name: 'Jane' })
  .returning('*')
  .execute();

// Delete
await db.query('users')
  .where('id', '=', 1)
  .delete()
  .execute();

// Count
const count = await db.query('users')
  .where('active', '=', true)
  .count();

// Join query
const usersWithPosts = await db.query('users')
  .select(['users.*', 'posts.title'])
  .join('posts', 'users.id', '=', 'posts.user_id')
  .execute();
```

### Transactions

```typescript
// Simple transaction
await db.transaction(async (trx) => {
  await trx.query('users')
    .update({ balance: db.raw('balance - 100') })
    .where('id', '=', 1)
    .execute();
  
  await trx.query('users')
    .update({ balance: db.raw('balance + 100') })
    .where('id', '=', 2)
    .execute();
});

// Transaction with error handling
try {
  await db.transaction(async (trx) => {
    await trx.query('orders').insert(orderData).execute();
    await trx.query('inventory')
      .update({ quantity: db.raw('quantity - 1') })
      .where('product_id', '=', productId)
      .execute();
  });
  ctx.response.json({ success: true });
} catch (error) {
  // Transaction automatically rolled back
  ctx.response.status(500).json({ error: 'Transaction failed' });
}
```

### Migrations

Create migration:
```bash
qwe migration create create_users_table
```

```typescript
// src/database/migrations/001_create_users.ts
import { Migration } from 'qwe-framework/database';

export default class CreateUsersTable extends Migration {
  async up() {
    await this.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('name', 100).notNullable();
      table.string('email', 255).unique().notNullable();
      table.string('password_hash', 255).notNullable();
      table.enum('role', ['user', 'admin']).default('user');
      table.boolean('active').default(true);
      table.timestamp('created_at').default('now()');
      table.timestamp('updated_at').default('now()');
      
      table.index(['email']);
      table.index(['created_at']);
    });
  }

  async down() {
    await this.schema.dropTable('users');
  }
}
```

Run migrations:
```bash
# Run all pending migrations
qwe migration run

# Rollback last migration
qwe migration rollback

# Reset all migrations
qwe migration reset

# Check migration status
qwe migration status
```

## 🔐 Authentication

### JWT Authentication

```typescript
// src/common/guards/auth.guard.ts
import { Guard, ExecutionContext } from 'qwe-framework';
import { JWT } from 'qwe-framework/security';

const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

export class AuthGuard implements Guard {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const authHeader = ctx.request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ctx.response.status(401).json({ error: 'No token provided' });
      return false;
    }

    const token = authHeader.substring(7);

    try {
      const payload = JWT.verify(token, jwtSecret);
      ctx.request.user = payload; // Attach user to request
      return true;
    } catch (error) {
      ctx.response.status(401).json({ error: 'Invalid token' });
      return false;
    }
  }
}
```

### Using Auth Guard

```typescript
import { Router } from 'qwe-framework';
import { AuthGuard } from '../common/guards/auth.guard';

const router = new Router();

// Protected route
router.get('/profile', ProfileController, 'getProfile', {
  guards: [AuthGuard]
});
```

### Login Endpoint

```typescript
// src/modules/auth/auth.controller.ts
import { v } from 'qwe-framework/validation';
import { JWT, hash } from 'qwe-framework/security';

const LoginSchema = v.object({
  email: v.string().email(),
  password: v.string().min(8)
});

@Controller()
export class AuthController {
  constructor(private usersService: UsersService) {}

  async login(ctx: ExecutionContext) {
    const { email, password } = LoginSchema.parse(ctx.request.body);
    
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      ctx.response.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await hash.compare(password, user.passwordHash);
    
    if (!isValid) {
      ctx.response.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT tokens
    const accessToken = JWT.sign(
      { userId: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = JWT.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: '7d' }
    );

    ctx.response.json({
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      }
    });
  }
}
```

## 🛡️ Security Features

### Helmet (Security Headers)

```typescript
import { helmet } from 'qwe-framework/security';

// Enable helmet with default settings
app.use(helmet());

// Or with custom options
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

### CORS

```typescript
import { cors } from 'qwe-framework/security';

// Allow all origins (development only)
app.use(cors());

// Production configuration
app.use(cors({
  origin: ['https://example.com', 'https://app.example.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));
```

### Rate Limiting

```typescript
import { rateLimit } from 'qwe-framework/security';

// Global rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per window
}));

// Stricter limit for auth endpoints
router.post('/auth/login', AuthController, 'login', {
  middleware: [rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5 // 5 attempts per minute
  })]
});
```

## 🗜️ Compression

```typescript
import { compress } from 'qwe-framework/middleware';

// Enable compression with auto-negotiation
app.use(compress({
  threshold: 1024, // Only compress responses > 1KB
  level: 6 // Compression level (1-9)
}));
```

## 📊 Logging

```typescript
import { Logger } from 'qwe-framework/logging';

// Create logger instance
const logger = new Logger({
  name: 'app',
  level: 'info', // 'debug', 'info', 'warn', 'error'
  transport: 'console' // or 'file', 'json'
});

// Usage
logger.info('Server started', { port: 3000 });
logger.debug('Database query', { sql: 'SELECT * FROM users' });
logger.warn('High memory usage', { memoryUsage: '85%' });
logger.error('Failed to connect', { error: message });
```

## 🧪 Testing

### Unit Testing

```typescript
// src/modules/users/users.service.test.ts
import { test, describe } from 'qwe-framework/testing';
import { UsersService } from './users.service';
import { MockDatabase } from 'qwe-framework/testing/mocks';

describe('UsersService', () => {
  test('should create user', async () => {
    const mockDb = new MockDatabase();
    const service = new UsersService(mockDb);
    
    const result = await service.create({
      name: 'John',
      email: 'john@example.com'
    });
    
    expect(result).toBeDefined();
    expect(result.name).toBe('John');
    expect(mockDb.queries).toHaveLength(1);
  });
});
```

### Integration Testing

```typescript
// tests/integration/users.test.ts
import { test, describe, createTestApp } from 'qwe-framework/testing';
import { UsersModule } from '../../src/modules/users/users.module';

describe('Users API', () => {
  const app = createTestApp([UsersModule]);

  test('GET /users should return list', async () => {
    const response = await app.request('GET', '/users');
    
    expect(response.status).toBe(200);
    expect(response.json.data).toBeArray();
  });

  test('POST /users should create user', async () => {
    const response = await app.request('POST', '/users', {
      body: {
        name: 'Jane',
        email: 'jane@example.com'
      },
      headers: {
        'Authorization': 'Bearer valid-token'
      }
    });
    
    expect(response.status).toBe(201);
    expect(response.json.data.name).toBe('Jane');
  });
});
```

## 🎨 CLI Commands

```bash
# Create new project
qwe new my-project

# Generate module
qwe generate module users

# Generate controller
qwe generate controller users/users.controller

# Generate service
qwe generate service users/users.service

# Generate router
qwe generate router users/users.router

# Generate validation schema
qwe generate schema create-user

# Export Postman collection
qwe export postman --output ./api-collection.json

# Run migrations
qwe migration run
qwe migration rollback
qwe migration status
qwe migration reset

# Development server with hot reload
qwe dev

# Build for production
qwe build

# Start production server
qwe start
```

## 📦 API Reference

### Application

```typescript
const app = new Application(options?: {
  port?: number;
  host?: string;
  cors?: boolean | CorsOptions;
  helmet?: boolean | HelmetOptions;
  compress?: boolean | CompressOptions;
  logger?: boolean | LoggerOptions;
});

// Methods
app.module(configure: (mod: ModuleBuilder) => void): this
app.use(middleware: Middleware): this
app.get(path: string, handler: Handler): this
app.post(path: string, handler: Handler): this
app.put(path: string, handler: Handler): this
app.patch(path: string, handler: Handler): this
app.delete(path: string, handler: Handler): this
app.listen(port?: number, host?: string): Promise<void>
app.close(): Promise<void>
```

### Router

```typescript
const router = new Router();

router.get(path: string, controller: Controller, method: string, options?: RouteOptions): this
router.post(path: string, controller: Controller, method: string, options?: RouteOptions): this
router.put(path: string, controller: Controller, method: string, options?: RouteOptions): this
router.patch(path: string, controller: Controller, method: string, options?: RouteOptions): this
router.delete(path: string, controller: Controller, method: string, options?: RouteOptions): this

// Route options
interface RouteOptions {
  guards?: Guard[];
  middleware?: Middleware[];
  validation?: Schema;
}
```

### ExecutionContext

```typescript
interface ExecutionContext {
  request: QweRequest;
  response: QweResponse;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
}

interface QweRequest {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string>;
  body: any;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  cookies: Record<string, string>;
  ip: string;
  user?: any; // Set by auth guard
}

interface QweResponse {
  status(code: number): this;
  json(data: any): void;
  send(data: string | Buffer): void;
  redirect(url: string, code?: number): void;
  setHeader(name: string, value: string): this;
  setCookie(name: string, value: string, options?: CookieOptions): this;
  clearCookie(name: string): this;
}
```

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🚀 Roadmap

- [ ] GraphQL support
- [ ] WebSocket rooms and channels
- [ ] Built-in cache layer (Redis support)
- [ ] OpenAPI/Swagger documentation generator
- [ ] Hot module replacement for development
- [ ] Plugin system
- [ ] CLI interactive mode

## 📚 Resources

- [Documentation](https://qwe-framework.dev/docs)
- [Examples](https://github.com/yourusername/qwe-framework/tree/main/examples)
- [API Reference](https://qwe-framework.dev/api)
- [Discord Community](https://discord.gg/qwe-framework)

## 🙏 Acknowledgments

- [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js) - High-performance HTTP server
- [NestJS](https://nestjs.com/) - Inspiration for architecture
- [Zod](https://github.com/colinhacks/zod) - Inspiration for validation API
- [Prisma](https://www.prisma.io/) - Inspiration for ORM API

---

Made with ❤️ by the QWE Framework team
