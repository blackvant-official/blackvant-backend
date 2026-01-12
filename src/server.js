import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

/* --------------------------------------------------
   CORS CONFIG (Express v5 compatible)
-------------------------------------------------- */
const allowedOrigins = [
  "https://blackvant.com",
  "https://www.blackvant.com",
  "https://admin.blackvant.com",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* --------------------------------------------------
   MIDDLEWARE (MOVE THIS UP)
-------------------------------------------------- */
app.use(express.json());

/* --------------------------------------------------
   OPTIONS HANDLER (AFTER json)
-------------------------------------------------- */
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use("/uploads", express.static("uploads"));


/* --------------------------------------------------
   HEALTH CHECK
-------------------------------------------------- */
app.get("/api/v1", (req, res) => {
  res.json({ message: "BlackVant Backend Running ✅" });
});

/* --------------------------------------------------
   ROUTES
-------------------------------------------------- */
import userRoutes from "./routes/user.routes.js";
import depositRoutes from "./routes/deposit.routes.js";
import withdrawalRoutes from "./routes/withdrawal.routes.js";
import transactionRoutes from "./routes/transactions.routes.js";
import supportRoutes from "./routes/support.routes.js";
import uploadsRoutes from "./routes/uploads.routes.js";
import { requireAuth } from "./middleware/auth.js";

// Admin Routes imports
import adminStatsRoutes from "./routes/admin/stats.admin.routes.js";
import adminDepositRoutes from "./routes/admin/deposit.admin.routes.js";
import adminWithdrawalRoutes from "./routes/admin/withdrawal.admin.routes.js";
import adminTransactionsRoutes from "./routes/admin/transactions.admin.routes.js";
import auditAdminRoutes from "./routes/admin/audit.admin.routes.js";
import ledgerAdminRoutes from "./routes/admin/ledger.admin.routes.js";
import adminEmailTestRoutes from "./routes/admin/email.test.routes.js";
import adminProfitOtpRoutes from "./routes/admin/profit.otp.routes.js";
import adminProfitDistributeRoutes from "./routes/admin/profit.distribute.routes.js";
import profitAdminRoutes from "./routes/admin/profit.admin.routes.js";
import adminSettingsRoutes from "./routes/admin/admin.settings.routes.js";


app.use("/api/v1", userRoutes);
app.use("/api/v1", depositRoutes);
app.use("/api/v1", withdrawalRoutes);
app.use("/api/v1", transactionRoutes);
app.use("/api/v1", supportRoutes);
app.use("/api/v1/uploads", requireAuth, uploadsRoutes);

// Admin Routes 
app.use("/api/v1/admin", adminStatsRoutes);
app.use("/api/v1/admin", adminDepositRoutes);
app.use("/api/v1/admin", adminWithdrawalRoutes);
app.use("/api/v1/admin", adminTransactionsRoutes);
app.use("/api/v1/admin", auditAdminRoutes);
app.use("/api/v1/admin/ledger", ledgerAdminRoutes);
app.use("/api/v1/admin", adminEmailTestRoutes);
app.use("/api/v1/admin", adminProfitOtpRoutes);
app.use("/api/v1/admin", adminProfitDistributeRoutes);
app.use("/api/v1/admin", profitAdminRoutes);
app.use("/api/v1/admin/settings", adminSettingsRoutes);

app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

/* --------------------------------------------------
   SYSTEM BOOTSTRAP
-------------------------------------------------- */
async function bootstrapSystemSetting() {
  const count = await prisma.systemSetting.count();

  if (count === 0) {
    await prisma.systemSetting.create({
      data: {
        capitalLockEnabled: false,
        capitalLockDays: 0,
        capitalLockStartAt: null,
      },
    });

    console.log("🟢 [BOOTSTRAP] SystemSetting row created");
  } else {
    console.log("ℹ️ [BOOTSTRAP] SystemSetting already exists");
  }
}

/* --------------------------------------------------
   START SERVER
-------------------------------------------------- */
const PORT = process.env.PORT || 10000;

async function startServer() {
  try {
    await prisma.$connect();
    await bootstrapSystemSetting();

    app.listen(PORT, () => {
      console.log(`🚀 BlackVant backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error("🔥 Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
