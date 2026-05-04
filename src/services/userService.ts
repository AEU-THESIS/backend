import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type { CreateStaffInput } from '../validations/userValidation'
import { emailService } from './emailService'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined')
}

export const userService = {
  /**
   * Returns all staff members belonging to a shop.
   * Passwords are explicitly excluded for security.
   * Supports pagination and filters out soft-deleted users.
   */
  async getStaffByShop(shopId: number, page: number = 1, limit: number = 10, search: string = '') {
    const skip = (page - 1) * limit

    const where: any = {
      shopId,
      deletedAt: null,
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { employeeId: { contains: search } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          imageUrl: true,
          isActive: true,
          employeeId: true,
          createdAt: true,
          roles: {
            select: {
              role: {
                select: { name: true, id: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return {
      data: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        imageUrl: user.imageUrl,
        isActive: user.isActive,
        employeeId: user.employeeId,
        createdAt: user.createdAt,
        role: user.roles[0]?.role.name || null,
        roleId: user.roles[0]?.role.id || null,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  },

  /**
   * Creates a new staff member for a shop.
   * - Generates a random temporary password (hashed)
   * - Inserts user + role_user pivot in a transaction
   * - Sends an account setup email with an 8-hour token
   */
  async createStaff(data: CreateStaffInput, shopId: number) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: data.email,
        deletedAt: null,
      },
    })

    if (existingUser) {
      throw new AppError(Messages.USER_ALREADY_EXISTS, HttpStatus.BAD_REQUEST)
    }

    const role = await prisma.role.findFirst({
      where: { id: data.roleId, shopId },
    })

    if (!role) {
      throw new AppError(Messages.ROLE_NOT_FOUND, HttpStatus.BAD_REQUEST)
    }

    // Generate a temporary unguessable password
    const randomPassword = Math.random().toString(36).slice(-12)
    const hashedPassword = await bcrypt.hash(randomPassword, 10)

    // Generate Employee ID: #SP-XXXX
    const employeeId = `#SP-${Math.floor(1000 + Math.random() * 9000)}`

    const user = await prisma.$transaction(async tx => {
      const newUser = await tx.user.create({
        data: {
          shopId,
          name: data.name,
          email: data.email,
          password: hashedPassword,
          phone: data.phone,
          address: data.address,
          imageUrl: data.imageUrl,
          isActive: data.isActive,
          employeeId: employeeId,
        },
      })

      const inviteToken = jwt.sign(
        { userId: newUser.id, email: newUser.email, type: 'password_reset' },
        JWT_SECRET,
        { expiresIn: '8h' }
      )
      const inviteExpires = new Date(Date.now() + 8 * 60 * 60 * 1000)

      const updatedUser = await tx.user.update({
        where: { id: newUser.id },
        data: {
          inviteToken,
          inviteExpires,
        },
      })

      await tx.roleUser.create({
        data: {
          userId: updatedUser.id,
          roleId: data.roleId,
        },
      })

      return updatedUser
    })

    try {
      await emailService.sendAccountSetupEmail(user.email, user.name, user.inviteToken!)
    } catch (error) {
      console.error('Failed to send account setup email:', error)
      // We don't throw here to ensure the user creation is considered successful
      // Resend logic can be triggered later since we persisted the token
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: role.name,
      roleId: role.id,
      phone: user.phone,
      address: user.address,
      imageUrl: user.imageUrl,
      isActive: user.isActive,
      employeeId: user.employeeId,
      createdAt: user.createdAt,
    }
  },

  async updateStaff(id: number, data: any, shopId: number) {
    const user = await prisma.user.findFirst({
      where: { id, shopId },
    })

    if (!user) {
      throw new AppError(Messages.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (data.email && data.email !== user.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          deletedAt: null,
        },
      })
      if (existingUser) {
        throw new AppError(Messages.USER_ALREADY_EXISTS, HttpStatus.BAD_REQUEST)
      }
    }

    const updateData: any = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      imageUrl: data.imageUrl,
      isActive: data.isActive,
    }

    // If the image was removed or changed, delete the old image file
    if (user.imageUrl && user.imageUrl !== data.imageUrl) {
      try {
        console.log('[UserService] Detecting image change/removal.')
        console.log(`[UserService] Old Image: ${user.imageUrl} | New Image: ${data.imageUrl}`)

        const uploadsDir = path.resolve(__dirname, '../../public/uploads')
        const oldFileName = path.basename(user.imageUrl)
        const oldFilePath = path.join(uploadsDir, oldFileName)

        console.log(`[UserService] Attempting to delete: ${oldFilePath}`)

        // Security check: ensure the resolved path is inside the uploads directory
        // and we only delete if the original URL actually pointed to our uploads
        if (user.imageUrl.startsWith('/uploads/') && oldFilePath.startsWith(uploadsDir)) {
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath)
            console.log('[UserService] Successfully deleted old image from file system.')
          } else {
            console.log('[UserService] File does not exist, nothing to delete.')
          }
        } else {
          console.log(
            '[UserService] Skipping deletion: path is outside uploads directory or external.'
          )
        }
      } catch (err) {
        console.error('[UserService] Failed to delete old image:', err)
      }
    }

    return await prisma.$transaction(async tx => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
      })

      if (data.roleId) {
        // Verify the role belongs to the same shop
        const role = await tx.role.findFirst({
          where: { id: data.roleId, shopId: user.shopId },
        })

        if (!role) {
          throw new AppError(Messages.ROLE_NOT_FOUND, HttpStatus.BAD_REQUEST)
        }

        // Update role if changed
        await tx.roleUser.deleteMany({ where: { userId: id } })
        await tx.roleUser.create({
          data: {
            userId: id,
            roleId: data.roleId,
          },
        })
      }

      return updatedUser
    })
  },

  async deleteStaff(id: number, shopId: number) {
    const user = await prisma.user.findFirst({
      where: { id, shopId },
    })

    if (!user) {
      throw new AppError(Messages.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    return await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    })
  },
}
