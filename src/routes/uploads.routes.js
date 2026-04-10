import express from "express";
import { signPutUrl, signGetUrl, objectExists } from "../utils/s3.js";
import prisma from "../utils/prisma.js"; // adjust import to your setup
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth.js";
import { requireWritable } from "../middleware/readOnly.js";


const router = express.Router();

const ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"];
const ALLOWED_PURPOSE = ["DEPOSIT_PROOF", "SUPPORT_MESSAGE"];
const MAX_SIZE = 5 * 1024 * 1024;

function isValidUploadMetadata({ clerkUserId, storageKey, purpose, mimeType, fileSize, originalName }) {
  if (!clerkUserId || typeof storageKey !== "string") return false;
  if (!ALLOWED_PURPOSE.includes(purpose)) return false;
  if (!ALLOWED_MIME.includes(mimeType)) return false;
  if (!Number.isFinite(Number(fileSize)) || Number(fileSize) <= 0 || Number(fileSize) > MAX_SIZE) {
    return false;
  }
  if (!originalName || typeof originalName !== "string") return false;

  const expectedPrefix = `users/${clerkUserId}/${purpose}/`;
  return storageKey.startsWith(expectedPrefix) && !storageKey.includes("..");
}

// Request signed upload URL
router.post(
  "/request",
  requireAuth,
  requireWritable,
  async (req, res) => {
  const { clerkUserId } = req.userContext; // Clerk middleware
  const { purpose, mimeType, fileSize, originalName, depositId, ticketId } = req.body;

  if (!clerkUserId) return res.sendStatus(401);
  if (!ALLOWED_PURPOSE.includes(purpose)) return res.status(400).json({ error: "Invalid purpose" });
  if (!ALLOWED_MIME.includes(mimeType)) return res.status(400).json({ error: "Invalid mime" });
  if (fileSize > MAX_SIZE) return res.status(400).json({ error: "File too large" });

  const safeName = originalName.replace(/[^\w.\-]/g, "_");
  const key = `users/${clerkUserId}/${purpose}/${uuidv4()}-${safeName}`;

  const uploadUrl = await signPutUrl({
    key,
    contentType: mimeType,
    contentLength: fileSize,
  });

  res.json({ uploadUrl, storageKey: key });
});

// Confirm upload and persist
router.post(
  "/confirm",
  requireAuth,
  requireWritable,
  async (req, res) => {
  const { clerkUserId } = req.userContext;
  const { storageKey, purpose, mimeType, fileSize, originalName, depositId, ticketId } = req.body;

  if (!clerkUserId) return res.sendStatus(401);
  if (!isValidUploadMetadata({ clerkUserId, storageKey, purpose, mimeType, fileSize, originalName })) {
    return res.status(400).json({ error: "Invalid upload metadata" });
  }

  const exists = await objectExists(storageKey);
  if (!exists) return res.status(400).json({ error: "Object not found" });

  const attachment = await prisma.fileAttachment.create({
    data: {
      ownerUserId: clerkUserId,
      purpose,
      mimeType,
      fileSize,
      storageKey,
      originalName,
      depositId,
      ticketId,
    },
  });

  res.json({ attachmentId: attachment.id });

});

// Signed download
router.get("/:id/download", async (req, res) => {
  const { clerkUserId } = req.userContext;
  const { id } = req.params;

  if (!clerkUserId) return res.sendStatus(401);

  const file = await prisma.fileAttachment.findUnique({ where: { id } });
  if (!file || file.ownerUserId !== clerkUserId) return res.sendStatus(403);

  const url = await signGetUrl(file.storageKey);
  res.redirect(url);
});

export default router;
