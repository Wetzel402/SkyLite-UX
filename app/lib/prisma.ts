import { PrismaClient } from "@prisma/client";

function prismaClientSingleton() {
  return new PrismaClient();
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
};

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (import.meta.env?.DEV)
  globalThis.prismaGlobal = prisma;
