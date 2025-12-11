import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

// CORS – must be first
app.use(
  cors({
    origin: ["https://blackvant.com", "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json());

// HEALTH CHECK
app.get("/api/v1", (req, res) => {
  res.json({ message: "BlackVant Backend Running ✅" });
});

// ----------- FIXED ROUTE PATHS (WITH src/) -----------
import userRoutes from "./src/routes/user.routes.js";
import depositRoutes from "./src/routes/deposit.routes.js";
import withdrawalRoutes from "./src/routes/withdrawal.routes.js";

import adminDepositRoutes from "./src/routes/admin/deposit.admin.routes.js";
import adminWithdrawalRoutes from "./src/routes/admin/withdrawal.admin.routes.js";
import adminStatsRoutes from "./src/routes/admin/stats.admin.routes.js";

import profitCalculateRoutes from "./src/routes/admin/profit/profit.calculate.routes.js";
import profitDistributeRoutes from "./src/routes/admin/profit/profit.distribute.routes.js";
import profitHistoryRoutes from "./src/routes/admin/profit/profit.history.routes.js";
import profitExportRoutes from "./src/routes/admin/profit/profit.export.routes.js";

// REGISTER ROUTES
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

// START SERVER
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 BlackVant backend running on port ${PORT}`)
);
