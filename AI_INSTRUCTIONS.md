# AI Instructions — RoutinCafe_POS Backend

> **This file is mandatory reading for all developers and AI agents working on this codebase.**

---

## Architecture: 4-Layer Pattern

All features **MUST** follow this strict 4-layer architecture:

```
Router → Controller → Service → Model (Prisma)
```

### Layer Responsibilities

| Layer | File Location | Responsibility |
| --- | --- | --- |
| **Router** | `src/routes/` | Define Express routes and attach controllers. No logic. |
| **Controller** | `src/controllers/` | Handle HTTP request/response. Parse params, call services, send responses. |
| **Service** | `src/services/` | **All business logic lives here.** Orchestrate data access via Prisma models. |
| **Model** | `prisma/schema.prisma` | Database schema definition only. Accessed through Prisma Client. |

### Rules

1. **Routers** only map HTTP methods + paths to controller methods. No validation, no logic.
2. **Controllers** must:
   - Extract and validate input (using **Zod** schemas).
   - Call the appropriate service method.
   - Return an HTTP response with the correct status code.
   - **Never** contain business logic or direct database calls.
3. **Services** must:
   - Contain **all** business logic.
   - Use Prisma Client for data access.
   - Be framework-agnostic (no `req`, `res`, or Express types).
   - Throw typed errors that controllers can catch and translate to HTTP responses.
4. **Models** are defined in `prisma/schema.prisma`. Do **not** create standalone model files.
5. **Documentation**: Every task **must** update the Swagger API documentation via OpenAPI/JSDoc comments above the target routes/controllers whenever an endpoint is created or modified.

---

## Coding Standards

### Early Returns

Use early returns to reduce nesting and improve readability.

```typescript
// ✅ GOOD
async function getUser(id: string) {
  if (!id) throw new AppError('ID is required', 400);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError('User not found', 404);

  return user;
}

// ❌ BAD
async function getUser(id: string) {
  if (id) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (user) {
      return user;
    } else {
      throw new AppError('User not found', 404);
    }
  } else {
    throw new AppError('ID is required', 400);
  }
}
```

### Error Handling

All async controller methods **MUST** use `try/catch` blocks.

```typescript
// ✅ GOOD
const getUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.findById(req.params.id);
    return res.status(200).json(user);
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
};
```

### Input Validation with Zod

All incoming request data **MUST** be validated with Zod schemas before being passed to a service.

```typescript
// src/validators/user.validator.ts
import { z } from 'zod';

export const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
```

```typescript
// Inside a controller
const body = CreateUserSchema.parse(req.body); // throws ZodError on failure
const user = await userService.create(body);
```

---

## File Naming Conventions

| Type | Pattern | Example |
| --- | --- | --- |
| Router | `<entity>.routes.ts` | `user.routes.ts` |
| Controller | `<entity>.controller.ts` | `user.controller.ts` |
| Service | `<entity>.service.ts` | `user.service.ts` |
| Validator | `<entity>.validator.ts` | `user.validator.ts` |
| Middleware | `<name>.middleware.ts` | `auth.middleware.ts` |
| Utility | `<name>.util.ts` | `response.util.ts` |
| Config | `<name>.config.ts` | `swagger.config.ts` |

---

## Summary

- **Router** → routes only.
- **Controller** → HTTP handling + Zod validation.
- **Service** → business logic + Prisma queries.
- **Model** → `prisma/schema.prisma` only.
- Use **early returns**, **try/catch**, and **Zod** everywhere.
