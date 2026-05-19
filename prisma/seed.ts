import { PrismaClient } from '@prisma/client'
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

  // ==========================================
  // 1. SHOP
  // ==========================================
  const shop = await prisma.shop.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'RoutinCafe',
      slug: 'routincafe',
      ownerName: 'Admin',
      currencySymbol: '$',
      exchangeRate: 4100,
      phone: '+855 12 345 678',
      address: 'Phnom Penh, Cambodia',
      receiptFooter: 'Thank you for visiting RoutinCafe! ☕',
    },
  })

  // ==========================================
  // 2. ROLES
  // ==========================================
  const adminRole = await prisma.role.upsert({
    where: { id: 1 },
    update: { name: ROLES.ADMIN },
    create: { id: 1, name: ROLES.ADMIN, shopId: shop.id },
  })

  const managerRole = await prisma.role.upsert({
    where: { id: 2 },
    update: { name: ROLES.MANAGER },
    create: { id: 2, name: ROLES.MANAGER, shopId: shop.id },
  })

  const cashierRole = await prisma.role.upsert({
    where: { id: 3 },
    update: { name: ROLES.CASHIER },
    create: { id: 3, name: ROLES.CASHIER, shopId: shop.id },
  })

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
  // 5. OPTION SETS (Size, Sugar, Ice)
  // ==========================================
  let sizeSet = await prisma.optionSet.findFirst({ where: { shopId: shop.id, name: 'Size' } })
  if (!sizeSet) {
    sizeSet = await prisma.optionSet.create({
      data: {
        shopId: shop.id,
        name: 'Size',
        elements: {
          create: [
            { label: 'Small', priceModifier: 0.0, position: 0 },
            { label: 'Medium', priceModifier: 0.5, position: 1 },
            { label: 'Large', priceModifier: 1.0, position: 2 },
          ],
        },
      },
    })
  }

  let sugarSet = await prisma.optionSet.findFirst({
    where: { shopId: shop.id, name: 'Sugar Level' },
  })
  if (!sugarSet) {
    sugarSet = await prisma.optionSet.create({
      data: {
        shopId: shop.id,
        name: 'Sugar Level',
        elements: {
          create: [
            { label: 'No Sugar', priceModifier: 0.0, position: 0 },
            { label: '25%', priceModifier: 0.0, position: 1 },
            { label: '50% (Standard)', priceModifier: 0.0, position: 2 },
            { label: '100%', priceModifier: 0.0, position: 3 },
          ],
        },
      },
    })
  }

  let iceSet = await prisma.optionSet.findFirst({ where: { shopId: shop.id, name: 'Ice Level' } })
  if (!iceSet) {
    iceSet = await prisma.optionSet.create({
      data: {
        shopId: shop.id,
        name: 'Ice Level',
        elements: {
          create: [
            { label: 'No Ice', priceModifier: 0.0, position: 0 },
            { label: 'Less Ice', priceModifier: 0.0, position: 1 },
            { label: 'Standard Ice', priceModifier: 0.0, position: 2 },
          ],
        },
      },
    })
  }

  // ==========================================
  // 6. PRODUCTS
  // ==========================================
  const productData = [
    // Coffee
    {
      name: 'Iced Latte',
      price: 4.0,
      categoryName: 'Coffee',
      hasModifiers: true,
      imageUrl:
        'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Americano',
      price: 3.0,
      categoryName: 'Coffee',
      hasModifiers: true,
      imageUrl:
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Cappuccino',
      price: 3.5,
      categoryName: 'Coffee',
      hasModifiers: true,
      imageUrl:
        'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Double Espresso',
      price: 3.0,
      categoryName: 'Coffee',
      hasModifiers: false,
      imageUrl:
        'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Flat White',
      price: 4.0,
      categoryName: 'Coffee',
      hasModifiers: true,
      imageUrl:
        'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80',
    },
    // Tea
    {
      name: 'Green Tea',
      price: 2.5,
      categoryName: 'Tea',
      hasModifiers: true,
      imageUrl:
        'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Matcha Latte',
      price: 4.25,
      categoryName: 'Tea',
      hasModifiers: true,
      imageUrl:
        'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80',
    },
    // Bakery
    {
      name: 'Butter Croissant',
      price: 2.5,
      categoryName: 'Bakery',
      hasModifiers: false,
      imageUrl:
        'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Banana Bread',
      price: 3.0,
      categoryName: 'Bakery',
      hasModifiers: false,
      imageUrl:
        'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=600&q=80',
    },
    // Breakfast
    {
      name: 'Avocado Toast',
      price: 6.5,
      categoryName: 'Breakfast',
      hasModifiers: false,
      imageUrl:
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
    },
    // Pastry
    {
      name: 'Chocolate Eclair',
      price: 3.75,
      categoryName: 'Pastry',
      hasModifiers: false,
      imageUrl:
        'https://images.unsplash.com/photo-1612203985729-70726954388c?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Strawberry Tart',
      price: 4.5,
      categoryName: 'Pastry',
      hasModifiers: false,
      imageUrl:
        'https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Macaron Assortment',
      price: 5.0,
      categoryName: 'Pastry',
      hasModifiers: false,
      imageUrl:
        'https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&w=600&q=80',
    },
  ]

  const products: Record<string, { id: number; price: number }> = {}
  for (const pd of productData) {
    const existing = await prisma.product.findFirst({ where: { shopId: shop.id, name: pd.name } })
    if (existing) {
      // Mock/Update existing product image URLs for testing
      await prisma.product.update({
        where: { id: existing.id },
        data: { imageUrl: pd.imageUrl },
      })
      products[pd.name] = { id: existing.id, price: Number(existing.price) }
    } else {
      const created = await prisma.product.create({
        data: {
          shopId: shop.id,
          categoryId: categories[pd.categoryName].id,
          name: pd.name,
          price: pd.price,
          imageUrl: pd.imageUrl,
          isAvailable: true,
        },
      })
      products[pd.name] = { id: created.id, price: Number(created.price) }

      // Link modifiers to drinks (Size + Sugar + Ice)
      if (pd.hasModifiers) {
        for (const optionSetId of [sizeSet.id, sugarSet.id, iceSet.id]) {
          await prisma.productOptionSet.create({
            data: { productId: created.id, optionSetId, isRequired: false },
          })
        }
      }
    }
  }

  // ==========================================
  // 7. INGREDIENTS
  // ==========================================
  const ingredientData = [
    { name: 'Espresso Beans', unitOfMeasure: 'gram', currentStock: 5000, lowStockThreshold: 500 },
    { name: 'Whole Milk', unitOfMeasure: 'ml', currentStock: 10000, lowStockThreshold: 1000 },
    { name: 'Oat Milk', unitOfMeasure: 'ml', currentStock: 5000, lowStockThreshold: 500 },
    { name: 'Simple Syrup', unitOfMeasure: 'ml', currentStock: 3000, lowStockThreshold: 300 },
    { name: 'Ice Cubes', unitOfMeasure: 'gram', currentStock: 20000, lowStockThreshold: 2000 },
    { name: 'Flour', unitOfMeasure: 'gram', currentStock: 8000, lowStockThreshold: 1000 },
    { name: 'Butter', unitOfMeasure: 'gram', currentStock: 3000, lowStockThreshold: 300 },
    { name: 'Sugar', unitOfMeasure: 'gram', currentStock: 5000, lowStockThreshold: 500 },
    { name: 'Avocado', unitOfMeasure: 'piece', currentStock: 30, lowStockThreshold: 5 },
    { name: 'Bread Slices', unitOfMeasure: 'piece', currentStock: 50, lowStockThreshold: 10 },
    { name: 'Banana', unitOfMeasure: 'piece', currentStock: 40, lowStockThreshold: 10 },
    { name: 'Green Tea Powder', unitOfMeasure: 'gram', currentStock: 1000, lowStockThreshold: 100 },
    { name: 'Matcha Powder', unitOfMeasure: 'gram', currentStock: 800, lowStockThreshold: 100 },
  ]

  const ingredients: Record<string, { id: number }> = {}
  for (const ing of ingredientData) {
    const existing = await prisma.ingredient.findFirst({
      where: { shopId: shop.id, name: ing.name },
    })
    if (existing) {
      ingredients[ing.name] = existing
    } else {
      const created = await prisma.ingredient.create({ data: { ...ing, shopId: shop.id } })
      ingredients[ing.name] = created
    }
  }

  // ==========================================
  // 8. PRODUCT RECIPES (per 1 unit)
  // ==========================================
  const recipeData: { productName: string; ingredientName: string; quantityRequired: number }[] = [
    { productName: 'Iced Latte', ingredientName: 'Espresso Beans', quantityRequired: 18 },
    { productName: 'Iced Latte', ingredientName: 'Whole Milk', quantityRequired: 180 },
    { productName: 'Iced Latte', ingredientName: 'Ice Cubes', quantityRequired: 150 },
    { productName: 'Iced Latte', ingredientName: 'Simple Syrup', quantityRequired: 15 },

    { productName: 'Americano', ingredientName: 'Espresso Beans', quantityRequired: 18 },
    { productName: 'Americano', ingredientName: 'Ice Cubes', quantityRequired: 150 },

    { productName: 'Cappuccino', ingredientName: 'Espresso Beans', quantityRequired: 18 },
    { productName: 'Cappuccino', ingredientName: 'Whole Milk', quantityRequired: 120 },

    { productName: 'Double Espresso', ingredientName: 'Espresso Beans', quantityRequired: 36 },

    { productName: 'Flat White', ingredientName: 'Espresso Beans', quantityRequired: 18 },
    { productName: 'Flat White', ingredientName: 'Whole Milk', quantityRequired: 150 },

    { productName: 'Green Tea', ingredientName: 'Green Tea Powder', quantityRequired: 5 },
    { productName: 'Green Tea', ingredientName: 'Ice Cubes', quantityRequired: 150 },

    { productName: 'Matcha Latte', ingredientName: 'Matcha Powder', quantityRequired: 8 },
    { productName: 'Matcha Latte', ingredientName: 'Oat Milk', quantityRequired: 200 },

    { productName: 'Butter Croissant', ingredientName: 'Flour', quantityRequired: 80 },
    { productName: 'Butter Croissant', ingredientName: 'Butter', quantityRequired: 40 },

    { productName: 'Banana Bread', ingredientName: 'Banana', quantityRequired: 2 },
    { productName: 'Banana Bread', ingredientName: 'Flour', quantityRequired: 120 },
    { productName: 'Banana Bread', ingredientName: 'Sugar', quantityRequired: 30 },

    { productName: 'Avocado Toast', ingredientName: 'Avocado', quantityRequired: 1 },
    { productName: 'Avocado Toast', ingredientName: 'Bread Slices', quantityRequired: 2 },
  ]

  for (const recipe of recipeData) {
    const productId = products[recipe.productName]?.id
    const ingredientId = ingredients[recipe.ingredientName]?.id
    if (!productId || !ingredientId) continue

    const existing = await prisma.productRecipe.findFirst({ where: { productId, ingredientId } })
    if (!existing) {
      await prisma.productRecipe.create({
        data: { productId, ingredientId, quantityRequired: recipe.quantityRequired },
      })
    }
  }

  // ==========================================
  // DONE
  // ==========================================
  console.log('\n✅ Seed completed successfully!')
  console.log('\n👤 USERS:')
  console.log('   📧 admin@routincafe.com    / password123  [Admin]')
  console.log('   📧 manager@routincafe.com  / password123  [Manager]')
  console.log('   📧 cashier@routincafe.com  / password123  [Cashier]')
  console.log('\n📦 CATALOG:')
  console.log(`   🗂️  ${Object.keys(categories).length} categories seeded`)
  console.log(`   🛍️  ${Object.keys(products).length} products seeded`)
  console.log(`   🔧 3 option sets (Size, Sugar Level, Ice Level)`)
  console.log('\n🏭 INVENTORY:')
  console.log(`   🧴 ${Object.keys(ingredients).length} ingredients seeded`)
  console.log(`   📋 ${recipeData.length} product recipe entries seeded`)
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
