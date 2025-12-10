import express from "express";
import dotenv from "dotenv";
import cors from "cors";

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Import routes
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


// Basic health route
app.get("/", (req, res) => {
  res.json({ message: "BlackVant Backend Running ✅" });
});

// Register routes
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


// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 BlackVant backend is running on http://localhost:${PORT}`);
});
