import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import bcrypt from 'bcryptjs'
import 'dotenv/config'
import { ROLES } from '../src/constants/roles'

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'routincafe_pos',
})

const prisma = new PrismaClient({ adapter })

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10)

  // 1. Create a default Shop
  const shop = await prisma.shop.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'RoutinCafe',
      slug: 'routincafe',
      ownerName: 'Admin',
      currencySymbol: '$',
      exchangeRate: 4100,
    },
  })

  // 2. Create Roles
  const adminRole = await prisma.role.upsert({
    where: { id: 1 },
    update: { name: ROLES.ADMIN },
    create: {
      id: 1,
      name: ROLES.ADMIN,
      shopId: shop.id,
    },
  })

  const managerRole = await prisma.role.upsert({
    where: { id: 2 },
    update: { name: ROLES.MANAGER },
    create: {
      id: 2,
      name: ROLES.MANAGER,
      shopId: shop.id,
    },
  })

  const cashierRole = await prisma.role.upsert({
    where: { id: 3 },
    update: { name: ROLES.CASHIER },
    create: {
      id: 3,
      name: ROLES.CASHIER,
      shopId: shop.id,
    },
  })

  // 3. Create Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@routincafe.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@routincafe.com',
      password: hashedPassword,
      shopId: shop.id,
      employeeId: '#SP-0001',
    },
  })

  // 4. Create Cashier User
  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@routincafe.com' },
    update: {},
    create: {
      name: 'Cashier User',
      email: 'cashier@routincafe.com',
      password: hashedPassword,
      shopId: shop.id,
      employeeId: '#SP-0002',
    },
  })

  // 5. Create Manager User
  const manager = await prisma.user.upsert({
    where: { email: 'manager@routincafe.com' },
    update: {},
    create: {
      name: 'Manager User',
      email: 'manager@routincafe.com',
      password: hashedPassword,
      shopId: shop.id,
      employeeId: '#SP-0003',
    },
  })

  // 5. Assign Roles
  await prisma.roleUser.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  })

  await prisma.roleUser.upsert({
    where: { userId_roleId: { userId: cashier.id, roleId: cashierRole.id } },
    update: {},
    create: { userId: cashier.id, roleId: cashierRole.id },
  })

  await prisma.roleUser.upsert({
    where: { userId_roleId: { userId: manager.id, roleId: managerRole.id } },
    update: {},
    create: { userId: manager.id, roleId: managerRole.id },
  })

  console.log('✅ Seed completed: Admin, Manager & Cashier created')
  console.log('   📧 admin@routincafe.com / password123')
  console.log('   📧 manager@routincafe.com / password123')
  console.log('   📧 cashier@routincafe.com / password123')
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
