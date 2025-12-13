import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

// ---------------------------------------------
// 1️⃣ FINAL CORS CONFIG (NODE 22 SAFE)
// ---------------------------------------------
const allowedOrigins = [
  "https://blackvant.com",
  "https://www.blackvant.com",
];

const corsMiddleware = cors({
  origin: function (origin, callback) {
    // allow curl / server-to-server
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

app.use(corsMiddleware);

// ✅ FIX: use middleware, NOT app.options("*")
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return corsMiddleware(req, res, () => res.sendStatus(204));
  }
  next();
});

// ---------------------------------------------
// 2️⃣ JSON PARSER
// ---------------------------------------------
app.use(express.json());

// ---------------------------------------------
// 3️⃣ HEALTH CHECK
// ---------------------------------------------
app.get("/api/v1", (req, res) => {
  res.json({ message: "BlackVant Backend Running ✅" });
});

// ---------------------------------------------
// 4️⃣ ROUTES
// ---------------------------------------------
import userRoutes from "./routes/user.routes.js";
import depositRoutes from "./routes/deposit.routes.js";
import withdrawalRoutes from "./routes/withdrawal.routes.js";

import adminDepositRoutes from "./routes/admin/deposit.admin.routes.js";
import adminWithdrawalRoutes from "./routes/admin/withdrawal.admin.routes.js";
import adminStatsRoutes from "./routes/admin/stats.admin.routes.js";

import profitCalculateRoutes from "./routes/admin/profit/profit.calculate.routes.js";
import profitDistributeRoutes from "./routes/admin/profit/profit.distribute.routes.js";
import profitHistoryRoutes from "./routes/admin/profit/profit.history.routes.js";
import profitExportRoutes from "./routes/admin/profit/profit.export.routes.js";

// ---------------------------------------------
// 5️⃣ REGISTER ROUTES
// ---------------------------------------------
app.use("/api/v1", userRoutes);
app.use("/api/v1", depositRoutes);
app.use("/api/v1", withdrawalRoutes);

app.use("/api/v1/admin", adminDepositRoutes);
app.use("/api/v1/admin", adminWithdrawalRoutes);
app.use("/api/v1/admin", adminStatsRoutes);

app.use("/api/v1/admin", profitCalculateRoutes);
app.use("/api/v1/admin", profitDistributeRoutes);
app.use("/api/v1/admin", profitHistoryRoutes);
app.use("/api/v1/admin", profitExportRoutes);

// ---------------------------------------------
// 6️⃣ START SERVER
// ---------------------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running with FINAL CORS on port ${PORT}`);
});
