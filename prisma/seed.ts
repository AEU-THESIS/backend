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
      slug: 'routinecafe',
      ownerName: 'Chamnap Pich Veacha',
      currencySymbol: '$',
      exchangeRate: 4100,
      phone: '+855 12 345 678',
      address: 'Phnom Penh, Cambodia',
      receiptFooter: 'Thank you for visiting Routine Café & Bakery!☕',
      // Default KHQR bank list shown in the POS bank selector (AT-112).
      paymentBanks: ['ABA'],
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
  // Routine Cafe physical menu groups (imported from the client's printed menu).
  // These three real groups lead the list; older placeholder categories were removed.
  const categoryData = [
    { name: 'Iced Drinks', sortOrder: 1 },
    { name: 'Hot Drinks', sortOrder: 2 },
    { name: 'Frappe', sortOrder: 3 },
    { name: 'Bakery', sortOrder: 4 },
  ]

  const categories: Record<string, { id: number }> = {}
  for (const cat of categoryData) {
    const existing = await prisma.category.findFirst({ where: { shopId: shop.id, name: cat.name } })
    if (existing) {
      // Keep sortOrder authoritative so re-seeding applies the intended ordering.
      categories[cat.name] = await prisma.category.update({
        where: { id: existing.id },
        data: { sortOrder: cat.sortOrder },
      })
    } else {
      const created = await prisma.category.create({ data: { ...cat, shopId: shop.id } })
      categories[cat.name] = created
    }
  }

  // ==========================================
  // 5. PRODUCTS (Routine Cafe printed menu — client go-live catalog)
  // ==========================================
  // Prices are USD (the $ value on the menu). All items are drinks with a fixed
  // price. The three printed menu groups map to categories: Iced / Hot / Frappe.
  // Some drinks appear in more than one group at different prices (e.g. Americano
  // is $1.25 iced but $1.00 hot), so each group keeps its own product row.
  const productData: { name: string; price: number; category: string }[] = [
    // --- Iced Drinks ---
    { name: 'Americano', price: 1.25, category: 'Iced Drinks' },
    { name: 'Latte', price: 1.25, category: 'Iced Drinks' },
    { name: 'Coffee Milk', price: 1.25, category: 'Iced Drinks' },
    { name: 'Cappuccino', price: 1.25, category: 'Iced Drinks' },
    { name: 'Mocha', price: 1.25, category: 'Iced Drinks' },
    { name: 'Caramel Latte', price: 1.25, category: 'Iced Drinks' },
    { name: 'Chocolate', price: 1.25, category: 'Iced Drinks' },
    { name: 'Matcha Latte', price: 1.5, category: 'Iced Drinks' },
    { name: 'Green Tea', price: 1.25, category: 'Iced Drinks' },
    { name: 'Red Tea', price: 1.25, category: 'Iced Drinks' },
    { name: 'Lemon Tea', price: 1.25, category: 'Iced Drinks' },
    { name: 'Strawberry Soda', price: 1.25, category: 'Iced Drinks' },
    { name: 'Blueberry Soda', price: 1.25, category: 'Iced Drinks' },
    { name: 'Passion Soda', price: 1.25, category: 'Iced Drinks' },
    { name: 'Milk Passion', price: 1.25, category: 'Iced Drinks' },
    { name: 'Passion Machiato', price: 1.5, category: 'Iced Drinks' },
    // --- Hot Drinks (name prefixed with "Hot" so it's unambiguous vs the iced row) ---
    { name: 'Hot Espresso', price: 1.0, category: 'Hot Drinks' },
    { name: 'Hot Americano', price: 1.0, category: 'Hot Drinks' },
    { name: 'Hot Latte', price: 1.25, category: 'Hot Drinks' },
    { name: 'Hot Coffee Milk', price: 1.25, category: 'Hot Drinks' },
    { name: 'Hot Cappuccino', price: 1.25, category: 'Hot Drinks' },
    { name: 'Hot Mocha', price: 1.25, category: 'Hot Drinks' },
    { name: 'Hot Matcha Latte', price: 1.25, category: 'Hot Drinks' },
    { name: 'Hot Chocolate', price: 1.25, category: 'Hot Drinks' },
    { name: 'Hot Green Tea', price: 1.25, category: 'Hot Drinks' },
    { name: 'Hot Lemon Tea', price: 1.25, category: 'Hot Drinks' },
    // --- Frappe ---
    { name: 'Café Frappe', price: 1.5, category: 'Frappe' },
    { name: 'Chocolate Frappe', price: 1.5, category: 'Frappe' },
    { name: 'Mocha Frappe', price: 1.5, category: 'Frappe' },
    { name: 'Matcha Frappe', price: 1.75, category: 'Frappe' },
    { name: 'Green Tea Frappe', price: 1.5, category: 'Frappe' },
    { name: 'Red Tea Frappe', price: 1.5, category: 'Frappe' },
    { name: 'Strawberry Smoothie', price: 1.5, category: 'Frappe' },
    { name: 'Blueberry Smoothie', price: 1.5, category: 'Frappe' },
  ]

  let productsCreated = 0
  for (const p of productData) {
    const category = categories[p.category]
    if (!category) continue // category guaranteed above, but stay defensive
    // Idempotent on (shopId, categoryId, name): re-running never duplicates.
    const existing = await prisma.product.findFirst({
      where: { shopId: shop.id, categoryId: category.id, name: p.name },
    })
    if (existing) continue
    await prisma.product.create({
      data: {
        shopId: shop.id,
        categoryId: category.id,
        name: p.name,
        price: p.price,
        type: 'drink',
        priceMode: 'fixed',
        isAvailable: true,
      },
    })
    productsCreated++
  }

  // ==========================================
  // 6. OPTIONS — Sugar level (preset percentage steps)
  // ==========================================
  // The café lets customers pick sweetness as a percentage. We model it with the
  // standard OptionSet system as discrete preset steps, which is how coffee /
  // bubble-tea POS systems handle sugar (a free 1–100 slider would need a new
  // numeric option type across schema, API and cart). Attached to every drink.
  const SUGAR_STEPS = ['0%', '25%', '50%', '75%', '100%']

  let sugarOptionSet = await prisma.optionSet.findFirst({
    where: { shopId: shop.id, name: 'Sugar' },
  })
  if (!sugarOptionSet) {
    sugarOptionSet = await prisma.optionSet.create({
      data: {
        shopId: shop.id,
        name: 'Sugar',
        type: 'custom',
        elements: {
          create: SUGAR_STEPS.map((label, i) => ({ label, priceModifier: 0, position: i })),
        },
      },
    })
  }

  // Link Sugar to every drink (idempotent per product).
  const drinks = await prisma.product.findMany({
    where: { shopId: shop.id, type: 'drink' },
    select: { id: true },
  })
  let sugarLinks = 0
  for (const d of drinks) {
    const linked = await prisma.productOptionSet.findFirst({
      where: { productId: d.id, optionSetId: sugarOptionSet.id },
    })
    if (!linked) {
      await prisma.productOptionSet.create({
        data: { productId: d.id, optionSetId: sugarOptionSet.id, isRequired: false },
      })
      sugarLinks++
    }
  }

  // Keep the reusable "Sugar" template in sync so staff get the % steps from the
  // Templates picker when adding new drinks.
  const sugarTemplate = await prisma.variationGroupTemplate.findFirst({
    where: { shopId: shop.id, name: 'Sugar' },
  })
  if (sugarTemplate) {
    await prisma.variationGroupTemplateOption.deleteMany({
      where: { templateId: sugarTemplate.id },
    })
    await prisma.variationGroupTemplateOption.createMany({
      data: SUGAR_STEPS.map((label, i) => ({
        templateId: sugarTemplate.id,
        optionLabel: label,
        priceModifier: 0,
        displayOrder: i,
      })),
    })
  } else {
    await prisma.variationGroupTemplate.create({
      data: {
        shopId: shop.id,
        name: 'Sugar',
        category: 'Drink',
        createdBy: admin.id,
        options: {
          create: SUGAR_STEPS.map((label, i) => ({
            optionLabel: label,
            priceModifier: 0,
            displayOrder: i,
          })),
        },
      },
    })
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
  console.log(`   🛍️  ${productData.length} menu products (${productsCreated} newly created)`)
  console.log(
    `   🍬 Sugar option (${SUGAR_STEPS.join(' / ')}) linked to ${drinks.length} drinks (${sugarLinks} newly linked)`
  )
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
