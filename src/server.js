import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

// -----------------------------
// 1️⃣ APPLY CORS FIRST (TOP)
// -----------------------------
app.use(
  cors({
    origin: ["https://blackvant.com", "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json());

// -----------------------------
// 2️⃣ HEALTH CHECK
// -----------------------------
app.get("/api/v1", (req, res) => {
  res.json({ message: "BlackVant Backend Running ✅" });
});

// -----------------------------
// 3️⃣ IMPORT ROUTES
// -----------------------------
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

// -----------------------------
// 4️⃣ REGISTER ROUTES
// -----------------------------
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

// -----------------------------
// 5️⃣ START SERVER
// -----------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 BlackVant backend running on port ${PORT}`)
);
