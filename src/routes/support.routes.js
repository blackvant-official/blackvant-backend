import express from "express";
import prisma from "../utils/prisma.js";
import requireAuth from "../middleware/auth.js";
import { requireWritable } from "../middleware/readOnly.js";

const router = express.Router();

// Generate readable ticket ID
function generateTicketId() {
  return `TK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

/**
 * CREATE SUPPORT TICKET
 * POST /api/v1/support/ticket
 */
router.post(
  "/support/ticket",
  requireAuth,
  requireWritable,
  async (req, res) => {
  try {
    const { subject, description, priority } = req.body;
    const { clerkUserId } = req.userContext;

    if (!subject || !description) {
      return res.status(400).json({ error: "Missing subject or description" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketId: generateTicketId(),
        userId: user.id,
        subject,
        description,
        priority: priority || "medium",
        messages: {
          create: {
            sender: "user",
            message: description
          }
        }
      }
    });

    res.json({
      success: true,
      ticketId: ticket.ticketId
    });

  } catch (err) {
    console.error("Create ticket error:", err);
    res.status(500).json({ error: "Failed to create support ticket" });
  }
});

/**
 * GET ALL USER TICKETS
 * GET /api/v1/support/tickets
 */
router.get("/support/tickets", requireAuth, async (req, res) => {
  try {
    const { userId } = req.userContext;

    if (!userId) {
      console.error("Missing userId in userContext");
      return res.status(500).json({ error: "User context missing" });
    }

    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    res.json(tickets);

  } catch (err) {
    console.error("Load tickets error (FULL):", err);
    res.status(500).json({ error: "Failed to load tickets" });
  }
});


/**
 * GET SINGLE TICKET + MESSAGES
 * GET /api/v1/support/ticket/:ticketId
 */
router.get("/support/ticket/:ticketId", requireAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { userId } = req.userContext;

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        ticketId,
        userId
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const messages = await prisma.supportMessage.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: "asc" }
    });

    res.json({
      ...ticket,
      messages
    });

  } catch (err) {
    console.error("Load ticket error (FULL):", err);
    res.status(500).json({ error: "Failed to load ticket" });
  }
});


export default router;
