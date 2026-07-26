import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import bcrypt from 'bcryptjs'
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { ROLES } from '../src/constants/roles'

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'routincafe_pos',
})

const prisma = new PrismaClient({ adapter })

let passwordSource = 'process.env.SEED_ADMIN_PASSWORD'

async function main() {
  // Determine secure password source
  let seedPassword = process.env.SEED_ADMIN_PASSWORD
  const seedPasswordPath = path.join(__dirname, '../.seed-password')

  if (!seedPassword) {
    if (fs.existsSync(seedPasswordPath)) {
      seedPassword = fs.readFileSync(seedPasswordPath, 'utf8').trim()
      passwordSource = 'loaded from backend/.seed-password'
    } else {
      seedPassword = crypto.randomBytes(16).toString('hex')
      passwordSource = 'generated and saved to backend/.seed-password'
      fs.writeFileSync(seedPasswordPath, seedPassword, { encoding: 'utf8', mode: 0o600 })
    }
  }

  const hashedPassword = await bcrypt.hash(seedPassword, 10)

  // ==========================================
  // 1. SHOP
  // ==========================================
  const shop = await prisma.shop.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Routine Café & Bakery',
      slug: 'routincafe',
      ownerName: 'Admin',
      currencySymbol: '$',
      exchangeRate: 4100,
      phone: '+855 12 345 678',
      address: 'Phnom Penh, Cambodia',
      receiptFooter: 'Thank you for visiting Routine Café & Bakery!☕',
    },
  })

  // ==========================================
  // 2. ROLES
  // ==========================================
  let adminRole = await prisma.role.findFirst({
    where: { name: ROLES.ADMIN, shopId: shop.id },
  })
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: { name: ROLES.ADMIN, shopId: shop.id },
    })
  }

  let managerRole = await prisma.role.findFirst({
    where: { name: ROLES.MANAGER, shopId: shop.id },
  })
  if (!managerRole) {
    managerRole = await prisma.role.create({
      data: { name: ROLES.MANAGER, shopId: shop.id },
    })
  }

  let cashierRole = await prisma.role.findFirst({
    where: { name: ROLES.CASHIER, shopId: shop.id },
  })
  if (!cashierRole) {
    cashierRole = await prisma.role.create({
      data: { name: ROLES.CASHIER, shopId: shop.id },
    })
  }

  // ==========================================
  // 3. USERS
  // ==========================================
  let admin = await prisma.user.findFirst({
    where: { email: 'admin@routincafe.com', isDeleted: false },
  })
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@routincafe.com',
        password: hashedPassword,
        shopId: shop.id,
        employeeId: '#SP-0001',
      },
    })
  }

  let cashier = await prisma.user.findFirst({
    where: { email: 'cashier@routincafe.com', isDeleted: false },
  })
  if (!cashier) {
    cashier = await prisma.user.create({
      data: {
        name: 'Cashier User',
        email: 'cashier@routincafe.com',
        password: hashedPassword,
        shopId: shop.id,
        employeeId: '#SP-0002',
      },
    })
  }

  let manager = await prisma.user.findFirst({
    where: { email: 'manager@routincafe.com', isDeleted: false },
  })
  if (!manager) {
    manager = await prisma.user.create({
      data: {
        name: 'Manager User',
        email: 'manager@routincafe.com',
        password: hashedPassword,
        shopId: shop.id,
        employeeId: '#SP-0003',
      },
    })
  }

  // Assign roles
  for (const { user, roleId } of [
    { user: admin, roleId: adminRole.id },
    { user: cashier, roleId: cashierRole.id },
    { user: manager, roleId: managerRole.id },
  ]) {
    const existing = await prisma.roleUser.findUnique({
      where: { userId_roleId: { userId: user.id, roleId } },
    })
    if (!existing) await prisma.roleUser.create({ data: { userId: user.id, roleId } })
  }

  // ==========================================
  // 4. CATEGORIES
  // ==========================================
  const categoryData = [
    { name: 'Coffee', sortOrder: 1 },
    { name: 'Tea', sortOrder: 2 },
    { name: 'Bakery', sortOrder: 3 },
    { name: 'Breakfast', sortOrder: 4 },
    { name: 'Pastry', sortOrder: 5 },
  ]

  const categories: Record<string, { id: number }> = {}
  for (const cat of categoryData) {
    const existing = await prisma.category.findFirst({ where: { shopId: shop.id, name: cat.name } })
    if (existing) {
      categories[cat.name] = existing
    } else {
      const created = await prisma.category.create({ data: { ...cat, shopId: shop.id } })
      categories[cat.name] = created
    }
  }

  // ==========================================
  // DONE
  // ==========================================
  console.log('\n✅ Seed completed successfully!')
  console.log('\n👤 USERS:')
  console.log(`   🔑 Credentials Source: ${passwordSource}`)
  console.log('   📧 admin@routincafe.com    [Admin]')
  console.log('   📧 manager@routincafe.com  [Manager]')
  console.log('   📧 cashier@routincafe.com  [Cashier]')
  console.log('\n📦 CATALOG:')
  console.log(`   🗂️  ${Object.keys(categories).length} categories seeded`)
  // console.log(`   🛍️  ${Object.keys(products).length} products seeded`)
  // console.log(`   🔧 3 option sets (Size, Sugar Level, Ice Level)`)
  // console.log('\n🏭 INVENTORY:')
  // console.log(`   🧴 ${Object.keys(ingredients).length} ingredients seeded`)
  // console.log(`   📋 ${recipeData.length} product recipe entries seeded`)
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
