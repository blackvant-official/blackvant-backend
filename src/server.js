import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

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
      // Allow server-to-server & curl
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


// 🔴 IMPORTANT: Express v5 DOES NOT allow app.options("*")
// So we handle OPTIONS like this:
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use("/uploads", express.static("uploads"));

/* --------------------------------------------------
   MIDDLEWARE
-------------------------------------------------- */
app.use(express.json());

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

app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

/* --------------------------------------------------
   START SERVER
-------------------------------------------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 BlackVant backend running on port ${PORT}`);
});
