import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "routincafe_pos",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("password123", 10);

  // 1. Create a default Shop
  const shop = await prisma.shop.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "RoutinCafe",
      slug: "routincafe",
      ownerName: "Admin",
      currencySymbol: "$",
      exchangeRate: 4100,
    },
  });

  // 2. Create Roles
  const adminRole = await prisma.role.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Admin",
      shopId: shop.id,
    },
  });

  const cashierRole = await prisma.role.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "Cashier",
      shopId: shop.id,
    },
  });

  // 3. Create Admin User
  const admin = await prisma.user.upsert({
    where: { email: "admin@routincafe.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@routincafe.com",
      password: hashedPassword,
      shopId: shop.id,
    },
  });

  // 4. Create Cashier User
  const cashier = await prisma.user.upsert({
    where: { email: "cashier@routincafe.com" },
    update: {},
    create: {
      name: "Cashier User",
      email: "cashier@routincafe.com",
      password: hashedPassword,
      shopId: shop.id,
    },
  });

  // 5. Assign Roles
  await prisma.roleUser.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  await prisma.roleUser.upsert({
    where: { userId_roleId: { userId: cashier.id, roleId: cashierRole.id } },
    update: {},
    create: { userId: cashier.id, roleId: cashierRole.id },
  });

  console.log("✅ Seed completed: Admin & Cashier users created");
  console.log("   📧 admin@routincafe.com / password123");
  console.log("   📧 cashier@routincafe.com / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
