/**
 * @openapi
 * tags:
 *   name: Notification
 *   description: In-app staff notification operations
 *
 * /api/notifications:
 *   get:
 *     tags:
 *       - Notification
 *     summary: Get paginated notifications for the shop
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 15
 *         description: Number of items per page
 *       - in: query
 *         name: read
 *         schema:
 *           type: boolean
 *         description: Filter by read status (true for read, false for unread)
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *       401:
 *         description: Unauthorized
 *
 * /api/notifications/unread-count:
 *   get:
 *     tags:
 *       - Notification
 *     summary: Get count of unread notifications
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Unread notification count retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 3
 *       401:
 *         description: Unauthorized
 *
 * /api/notifications/read-all:
 *   patch:
 *     tags:
 *       - Notification
 *     summary: Mark all unread notifications as read
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       401:
 *         description: Unauthorized
 *
 * /api/notifications/{id}/read:
 *   patch:
 *     tags:
 *       - Notification
 *     summary: Mark a single notification as read
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 *       401:
 *         description: Unauthorized
 *
 * /api/notifications/clear-all:
 *   delete:
 *     tags:
 *       - Notification
 *     summary: Delete all notifications for the shop
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications cleared successfully
 *       401:
 *         description: Unauthorized
 *
 * /api/notifications/bulk-delete:
 *   post:
 *     tags:
 *       - Notification
 *     summary: Delete selected notifications by IDs
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Notifications deleted successfully
 *       401:
 *         description: Unauthorized
 *
 * /api/notifications/{id}:
 *   delete:
 *     tags:
 *       - Notification
 *     summary: Delete a single notification
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *       404:
 *         description: Notification not found
 *       401:
 *         description: Unauthorized
 */
