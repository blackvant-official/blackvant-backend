import prisma from "../utils/prisma.js";

export async function logAudit({
  actorId,
  action,
  entityType,
  entityId,
  meta = {},
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        meta,
      },
    });
  } catch (err) {
    console.error("AUDIT LOG ERROR:", err);
  }
}
