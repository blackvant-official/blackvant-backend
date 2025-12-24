import express from "express";
import { PrismaClient } from "@prisma/client";
import requireAuth from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Generate readable ticket ID
function generateTicketId() {
  return "TK-" + Math.random().toString(36).substring(2, 8).toUpperCase()
 ?? Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * CREATE SUPPORT TICKET
 * POST /api/v1/support/ticket
 */
router.post("/support/ticket", requireAuth, async (req, res) => {
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
    console.log("SUPPORT TICKETS CONTEXT:", req.userContext);

    const { userId } = req.userContext;

    if (!userId) {
      console.error("Missing userId in userContext");
      return res.status(500).json({ error: "User context missing" });
    }

    console.log("QUERYING SUPPORT TICKETS FOR USER:", userId);

    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    console.log("SUPPORT TICKETS FOUND:", tickets.length);

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
      },

        where: {
          ticketId,
          userId
        }
      });

  

    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(ticket);

  } catch (err) {
    console.error("Load ticket error:", err);
    res.status(500).json({ error: "Failed to load ticket" });
  }
});

export default router;
