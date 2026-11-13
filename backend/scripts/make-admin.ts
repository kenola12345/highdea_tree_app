import { prisma } from "../src/lib/prisma.js";

/**
 * 有効なユーザーを ADMIN にする（npm run make-admin -w backend -- <email>）。
 * 管理者を付与する API は意図的に存在しないため、このスクリプトだけで付与する（manifests/common.md §2, §9）。
 */
async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run make-admin -w backend -- <email>");
    process.exitCode = 1;
    return;
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, deletedAt: true },
  });
  if (!user || user.deletedAt) {
    console.error(`No active user with the email ${email}.`);
    process.exitCode = 1;
    return;
  }
  if (user.role === "ADMIN") {
    console.warn(`${email} is already an admin.`);
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  console.warn(`${email} is now an admin. The change applies on their next request.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
