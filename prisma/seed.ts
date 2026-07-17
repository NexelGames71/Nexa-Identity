import { PrismaClient } from "@prisma/client";
import { defaultProducts } from "../src/products/products.js";

const prisma = new PrismaClient();

try {
  for (const product of defaultProducts) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: { name: product.name },
      create: product
    });
  }

  console.log(`Seeded ${defaultProducts.length} Nexa products.`);
} finally {
  await prisma.$disconnect();
}
