# AI Instructions — RoutinCafe_POS Backend

> **This file is mandatory reading for all developers and AI agents working on this codebase.**

---

## Architecture: 4-Layer Pattern

All features **MUST** follow this strict 4-layer architecture:

```
Router → Controller → Service → Model (Prisma)
```

### Layer Responsibilities

| Layer          | File Location          | Responsibility                                                                                          |
| -------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| **Router**     | `src/routes/`          | Define Express routes and attach controllers. Protect routes using `authMiddleware`.                    |
| **Controller** | `src/controllers/`     | Handle HTTP request/response. Extract Zod payloads explicitly, call services, and use `apiResponse.ts`. |
| **Service**    | `src/services/`        | **All business logic lives here.** Orchestrate data access via Prisma models.                           |
| **Model**      | `prisma/schema.prisma` | Database schema definition only. Accessed through Prisma Client.                                        |

### Core Rules

1. **Routers** map HTTP paths to controller methods. Use `authenticate` and `requireRoles` from `src/middlewares`.
2. **Controllers** must:
   - Extract and validate input using **Zod** (`req.body` → `schema.parse`).
   - Be wrapped in `catchAsync` to automate error propagation to the global handler.
   - Return using `sendSuccess` helper.
   - **Crucial**: Import `Request`, `Response`, `catchAsync`, `sendSuccess`, etc. from `src/core/Controller` to avoid redundant boilerplate.
3. **Services** must:
   - Throw typed errors using `AppError(Messages.REASON, HttpStatus.CODE)` for business constraints.
   - Never use Express specific classes.
   - **Crucial**: Import `prisma`, `AppError`, `HttpStatus`, and `Messages` entirely from `src/core/Service`.
4. **Error Handling**: Do not write `try/catch` in controllers. Let `catchAsync` bounce errors securely to the global `errorHandler`.
5. **No Magic Strings**: Always use `HttpStatus` and `Messages` imported from `src/constants/`.

---

## File Naming Conventions (CamelCase standard)

| Type       | Pattern                   | Example                                  |
| ---------- | ------------------------- | ---------------------------------------- |
| Router     | `<entity>Routes.ts`       | `authRoutes.ts`, `userRoutes.ts`         |
| Controller | `<entity>Controller.ts`   | `authController.ts`, `shopController.ts` |
| Service    | `<entity>Service.ts`      | `authService.ts`, `userService.ts`       |
| Validator  | `<entity>Validation.ts`   | `authValidation.ts`                      |
| Middleware | `<name>Middleware.ts`     | `authMiddleware.ts`                      |
| Utility    | `<name>.ts`               | `appError.ts`, `apiResponse.ts`          |
| Core Setup | `<Name>.ts` (Capitalized) | `Controller.ts`, `Service.ts`            |

## Anti-Spaghetti Rules (Strict Adherence Required)

1. **Skinny Controllers, Fat Services**: Controllers merely parse input via Zod and format output using `sendSuccess`. **Zero business logic** should ever exist in a Controller.
2. **File Decomposition**: Never generate monolithic 1000-line service files. As domains scale, aggressively segregate them vertically (e.g., `shopInventoryService.ts`, `shopMenuService.ts` instead of one giant `shopService.ts`).
3. **Strict Layer Isolation**: `prisma` calls are heavily BANNED in Routers and Controllers. Database querying belongs exclusively within the `src/services/` layer.
4. **Cross-Service Orchestration**: If an endpoint performs multiple complex domain tasks (creates a user, builds a shop, fires an email), do not dump 300 lines of code into one service function. Abstract them gracefully (calling `userService.create` then `emailService.send`).
5. **No Nesting**: Rely heavily on early returns (Guard Clauses) to keep code extremely flat.

---

## Summary

- Use **early returns**.
- Automate HTTP codes via **`HttpStatus`** and strings via **`Messages`**.
- Automate errors via **`AppError`** + **`catchAsync`**.
