import { Request, Response, HttpStatus, Messages } from '../core/Controller'
import { prisma } from '../core/Service'

// Map of shopId -> Array of active authenticated staff client responses
const activeClients = new Map<number, Response[]>()

// Map of shopId -> Array of active public customer client responses
interface PublicClient {
  res: Response
  telegramUserId?: string
}
const publicClients = new Map<number, PublicClient[]>()

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
      `📡 Staff connected to SSE stream for Shop #${shopId}. Active staff clients: ${clients.length}`
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
        `🔌 Staff disconnected from SSE stream for Shop #${shopId}. Remaining: ${filteredClients.length}`
      )
    })
  },

  async subscribePublic(req: Request, res: Response) {
    const slug = String(req.params.slug ?? '')
    if (!slug) {
      res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Shop slug required' })
      return
    }

    let shopId = 0
    try {
      const shop = await prisma.shop.findUnique({
        where: { slug },
        select: { id: true },
      })
      if (shop) {
        shopId = shop.id
      }
    } catch {
      // ignore
    }

    if (!shopId) {
      res.status(HttpStatus.NOT_FOUND).json({ success: false, message: Messages.SHOP_NOT_FOUND })
      return
    }

    const telegramUserId = req.telegramUser?.id
      ? String(req.telegramUser.id)
      : req.query.telegramUserId
        ? String(req.query.telegramUserId)
        : undefined

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    res.write(`data: ${JSON.stringify({ status: 'connected', shopId, role: 'customer' })}\n\n`)

    const currentPublic = publicClients.get(shopId) || []
    currentPublic.push({ res, telegramUserId })
    publicClients.set(shopId, currentPublic)

    const keepAliveInterval = setInterval(() => {
      res.write(':keepalive\n\n')
    }, 25000)

    req.on('close', () => {
      clearInterval(keepAliveInterval)
      const list = publicClients.get(shopId) || []
      const filtered = list.filter(c => c.res !== res)
      if (filtered.length > 0) {
        publicClients.set(shopId, filtered)
      } else {
        publicClients.delete(shopId)
      }
    })
  },

  broadcastToShop(shopId: number, event: 'order_created' | 'order_updated', orderData: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(orderData)}\n\n`

    // Dispatch to staff clients
    const clients = activeClients.get(shopId)
    if (clients && clients.length > 0) {
      clients.forEach(client => {
        try {
          client.write(payload)
        } catch (error) {
          console.error(`❌ Failed to send SSE payload to staff in Shop #${shopId}`, error)
        }
      })
    }

    // Dispatch to public customer clients
    const pubList = publicClients.get(shopId)
    if (pubList && pubList.length > 0) {
      pubList.forEach(client => {
        // If client specified telegramUserId, only send if matching or broadcast
        if (
          !client.telegramUserId ||
          !orderData.telegramUserId ||
          String(orderData.telegramUserId) === client.telegramUserId
        ) {
          try {
            client.res.write(payload)
          } catch {
            // client disconnected
          }
        }
      })
    }
  },

  safeBroadcastToShop(shopId: number, event: 'order_created' | 'order_updated', orderData: any) {
    try {
      this.broadcastToShop(shopId, event, orderData)
    } catch (error) {
      console.error(`⚠️ [SSE] safeBroadcastToShop failed for Shop #${shopId}:`, error)
    }
  },
}
