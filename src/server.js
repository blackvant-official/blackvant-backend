import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authMiddleware from "./middleware/auth.js";
import userRoutes from "./routes/user.routes.js";

dotenv.config();

const app = express();

/* -------------------------------------------------
   🔥 CORS — MUST BE FIRST (CRITICAL)
---------------------------------------------------*/
app.use(
  cors({
    origin: ["https://blackvant.com"],
    credentials: true,
  })
);

// Handle preflight explicitly
app.options("*", cors());

/* -------------------------------------------------
   BASIC MIDDLEWARE
---------------------------------------------------*/
app.use(express.json());

/* -------------------------------------------------
   HEALTH CHECK (NO AUTH)
---------------------------------------------------*/
app.get("/api/v1", (req, res) => {
  res.json({ message: "BlackVant Backend Running ✅" });
});

/* -------------------------------------------------
   AUTHENTICATED ROUTES
---------------------------------------------------*/
app.use("/api/v1", authMiddleware);
app.use("/api/v1", userRoutes);

/* -------------------------------------------------
   GLOBAL ERROR HANDLER (IMPORTANT)
---------------------------------------------------*/
app.use((err, req, res, next) => {
  console.error("🔥 Backend error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

/* -------------------------------------------------
   START SERVER
---------------------------------------------------*/
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 BlackVant backend running on port ${PORT}`);
});
