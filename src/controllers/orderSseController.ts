import { Request, Response, HttpStatus, Messages } from '../core/Controller'

// Map of shopId -> Array of active client responses
const activeClients = new Map<number, Response[]>()

export const orderSseController = {
  subscribe(req: Request, res: Response) {
    const shopId = req.user?.shop_id

    if (!shopId) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.SHOP_ID_REQUIRED })
      return
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')

    // Disable buffering in Nginx if applicable
    res.setHeader('X-Accel-Buffering', 'no')

    // Confirm connection to client
    res.write(`data: ${JSON.stringify({ status: 'connected', shopId })}\n\n`)

    // Save client connection
    const clients = activeClients.get(shopId) || []
    clients.push(res)
    activeClients.set(shopId, clients)

    console.log(
      `📡 Client connected to SSE stream for Shop #${shopId}. Active clients: ${clients.length}`
    )

    // Keepalive ping to prevent proxy timeout
    const keepAliveInterval = setInterval(() => {
      res.write(':keepalive\n\n')
    }, 25000)

    // Handle connection termination
    req.on('close', () => {
      clearInterval(keepAliveInterval)
      const shopClients = activeClients.get(shopId) || []
      const filteredClients = shopClients.filter(client => client !== res)

      if (filteredClients.length > 0) {
        activeClients.set(shopId, filteredClients)
      } else {
        activeClients.delete(shopId)
      }

      console.log(
        `🔌 Client disconnected from SSE stream for Shop #${shopId}. Remaining: ${filteredClients.length}`
      )
    })
  },

  broadcastToShop(shopId: number, event: 'order_created' | 'order_updated', orderData: any) {
    const clients = activeClients.get(shopId)

    if (!clients || clients.length === 0) {
      return
    }

    const payload = `event: ${event}\ndata: ${JSON.stringify(orderData)}\n\n`

    // Dispatch events to all active devices
    clients.forEach(client => {
      try {
        client.write(payload)
      } catch (error) {
        console.error(`❌ Failed to send SSE payload to a client in Shop #${shopId}`, error)
      }
    })
  },

  safeBroadcastToShop(shopId: number, event: 'order_created' | 'order_updated', orderData: any) {
    try {
      this.broadcastToShop(shopId, event, orderData)
    } catch (error) {
      console.error(`⚠️ [SSE] safeBroadcastToShop failed for Shop #${shopId}:`, error)
    }
  },
}
