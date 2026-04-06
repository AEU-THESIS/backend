# RoutinCafe POS Developer Guide

Welcome to the backend architecture! This standardized Express.js + Prisma API is focused on **simplicity, security, and predictability.**

## Directory Structure

- `/src/constants/`: Enums and Constants (ex: HTTP codes, generic error messages)
- `/src/core/`: Barrel files to consolidate and standardize dependency imports (e.g., `Controller.ts`, `Service.ts`)
- `/src/controllers/`: Handle HTTP parsing & response formatting via utility wrappers
- `/src/docs/`: Segregated Swagger specifications mapped by OpenAPI
- `/src/middlewares/`: Security & Logic middleware layer
- `/src/routes/`: Route bindings (No logic here)
- `/src/services/`: Core Business Logic and Database transactions
- `/src/utils/`: Common API helper utilities (e.g., `catchAsync`)
- `/src/validations/`: Zod schemas

## Writing a New Feature (4-Step Process)

**1. Zod Validation (src/validations/)**
Always design strict request schemas first.

**2. Core Service (src/services/)**
Do the DB lifting. Throw specific `AppError` on rule violations.

```typescript
import { AppError } from "../utils/appError";
import { HttpStatus } from "../constants/httpStatus";

if (badThing) {
  throw new AppError("A clean message", HttpStatus.BAD_REQUEST);
}
```

**3. Controller Wrapper (src/controllers/)**
Wrap your logic effortlessly. No `try/catch` needed thanks to the global handler. Use the `core/Controller` exports to avoid redundant imports.

```typescript
import { Request, Response, catchAsync, sendSuccess } from "../core/Controller";

export const itemController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const item = await itemService.create(req.body);
    return sendSuccess(res, item); // Standardized { success: true, data: {...} } format
  }),
};
```

**4. Routing & Roles (src/routes/)**
Secure the endpoints.

```typescript
import { authenticate } from "../middlewares/authMiddleware";
import { requireRoles } from "../middlewares/roleMiddleware";

router.post("/", authenticate, requireRoles(["Admin"]), itemController.create);
```

## 🍝 Anti-Spaghetti Regulations (Clean Code)

To prevent the codebase from becoming unmaintainable over time, strictly adhere to these practices:

1. **Fat Services, Skinny Controllers**
   - Controllers should do nothing but pass data from `req.body` directly into the Service layer and return the output via `sendSuccess`. If a Controller has an `if/else` statement regarding business logic, it is structurally flawed.
2. **Break Down Huge Files**
   - Do not allow a Service file to grow beyond 300-400 lines of code. If `shopService.ts` gets too big, physically segregate it into smaller logical sub-services (e.g., `shopInventoryService.ts`, `shopPromotionService.ts`).
3. **No Hidden Database Calls**
   - Use `prisma` exclusively inside `src/services/`. NEVER import or use `prisma` inside a router, controller, middleware, or validation schema.
4. **Descriptive, Contextual Naming**
   - Variables must indicate their contents intuitively. Use `userShopList` instead of a generic `data`. Use `hasPendingOrder` rather than `isStatusTrue`.
5. **Single Responsibility Functions**
   - Functions should execute exactly one architectural task. If a function is validating data, saving to a database, generating a token, and sending an email consecutively in the same massive block, it is spaghetti. Delegate out specifically formatted helper logic.
6. **Strict RESTful Routing**
   - Routes must use lowercase, pluralized nouns (e.g., `GET /api/shops`, `POST /api/users`). Do not use verbs in the URL path.
7. **Documentation Enforcement**
   - Every single new endpoint mapped in `src/routes/` MUST have a corresponding `@openapi` standard YAML block added to `src/docs/` outlining the payload and expected errors.
8. **Best Return Practices**
   - For successful JSON responses, return via `sendSuccess` from `src/core/Controller` to keep API structure uniform.
   - Exceptions are allowed for non-JSON/stream/file responses, `204 No Content`, and centralized error handling paths.

## Security Overview

- Passwords are encrypted via `bcryptjs`.
- Identity verification is handled purely via JWT extraction on protected endpoints via `authenticate`.
- Unhandled rejections or Zod errors automatically fold into uniform `{ success: false, message: ... }` responses via the global `errorHandler`.
