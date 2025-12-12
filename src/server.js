import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

// ---------------------------------------------
// 1️⃣ MANUAL CORS OVERRIDE (ALWAYS WORKS)
// ---------------------------------------------
const allowedOrigins = [
  "https://blackvant.com",
  "https://www.blackvant.com"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// ---------------------------------------------
// 2️⃣ OPTIONAL SECONDARY CORS LIBRARY
// ---------------------------------------------
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ---------------------------------------------
// 3️⃣ JSON PARSER
// ---------------------------------------------
app.use(express.json());

// ---------------------------------------------
// 4️⃣ HEALTH CHECK
// ---------------------------------------------
app.get("/api/v1", (req, res) => {
  res.json({ message: "BlackVant Backend Running ✅" });
});

// ---------------------------------------------
// 5️⃣ ROUTES
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
// 6️⃣ REGISTER ROUTES
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
// 7️⃣ START SERVER
// ---------------------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🔥 CORS OVERRIDE ACTIVE — Backend running on ${PORT}`);
});
