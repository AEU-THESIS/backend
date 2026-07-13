/**
 * @openapi
 * components:
 *   schemas:
 *     Promotion:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         name: { type: string, example: Weekend Pastry Discount }
 *         code: { type: string, nullable: true, example: WEEKEND15 }
 *         discountType:
 *           type: string
 *           enum: [PERCENTAGE, FIXED_AMOUNT, BOGO]
 *         discountValue: { type: number, example: 15 }
 *         scope:
 *           type: string
 *           enum: [ALL, SPECIFIC]
 *         isActive: { type: boolean, example: true }
 *         startDate: { type: string, format: date-time, nullable: true }
 *         endDate: { type: string, format: date-time, nullable: true }
 *         categoryIds:
 *           type: array
 *           items: { type: integer }
 *         productIds:
 *           type: array
 *           items: { type: integer }
 *     PromotionInput:
 *       type: object
 *       required: [name, discountType]
 *       properties:
 *         name: { type: string, example: Weekend Pastry Discount }
 *         code: { type: string, nullable: true, example: WEEKEND15 }
 *         discountType:
 *           type: string
 *           enum: [PERCENTAGE, FIXED_AMOUNT, BOGO]
 *         discountValue: { type: number, example: 15 }
 *         scope:
 *           type: string
 *           enum: [ALL, SPECIFIC]
 *           default: ALL
 *         isActive: { type: boolean, example: false }
 *         startDate: { type: string, format: date-time, nullable: true }
 *         endDate: { type: string, format: date-time, nullable: true }
 *         categoryIds:
 *           type: array
 *           items: { type: integer }
 *           description: Category ids to target when scope is SPECIFIC.
 *         productIds:
 *           type: array
 *           items: { type: integer }
 *           description: Product ids to target when scope is SPECIFIC.
 *
 * @openapi
 * /api/promotions:
 *   get:
 *     tags: [Promotions]
 *     summary: List promotions (paginated) with dashboard summary
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches promotion name or code.
 *     responses:
 *       200:
 *         description: A page of promotions plus summary counts.
 *   post:
 *     tags: [Promotions]
 *     summary: Create a promotion (nested scope arrays inserted transactionally)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PromotionInput' }
 *     responses:
 *       201:
 *         description: Promotion created.
 *       400:
 *         description: Validation error or scope items not owned by the shop.
 *
 * @openapi
 * /api/promotions/{id}:
 *   get:
 *     tags: [Promotions]
 *     summary: Get a single promotion
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: The promotion. }
 *       404: { description: Not found. }
 *   put:
 *     tags: [Promotions]
 *     summary: Update a promotion (partial payload allowed, e.g. status toggle)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PromotionInput' }
 *     responses:
 *       200: { description: Promotion updated. }
 *       404: { description: Not found. }
 *   delete:
 *     tags: [Promotions]
 *     summary: Delete a promotion
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Promotion deleted. }
 *       404: { description: Not found. }
 *       409: { description: Promotion is used by orders and cannot be deleted. }
 */
export {}
