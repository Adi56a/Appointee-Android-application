// index.js


const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const doctorRoutes = require('./routes/DoctorRoutes');
const mrRoutes = require('./routes/MedicalRepresentativeRoute')

dotenv.config();

const app = express();

/* ==================================================
   Environment Variables
================================================== */
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

/* ==================================================
   Middleware
================================================== */

// CORS Configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  })
);

// Body Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ==================================================
   Health Check Route
================================================== */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running successfully 🚀",
    environment: NODE_ENV,
  });
});

/* ==================================================
   Doctor Routes
================================================== */
app.use("/api/doctors", doctorRoutes);
app.use('/api/mr', mrRoutes)

/* ==================================================
   Global Error Handler
================================================== */
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: NODE_ENV === "development" ? err.message : "Internal Server Error",
  });
});

/* ==================================================
   Start Server
================================================== */
const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} [${NODE_ENV.toUpperCase()}]`);
  });
};

startServer();

/* ==================================================
   Process Error Handlers
================================================== */
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  process.exit(1);
});