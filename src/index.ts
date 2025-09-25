import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { paymentsRouter } from "./routes/payments.js";
import { postPaymentRouter } from "./routes/post-payment.js";
import { usersRouter } from "./routes/users.js";
import { analyzeRouter } from "./routes/analyze.js";
import { healthRouter } from "./routes/health.js";
import { billingPortalRouter } from "./routes/billing-portal.js";
import { autumnRouter } from "./routes/autumn.js";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || "server/.env" });

const app = express();
const port = Number(process.env.PORT || 4001);

// Keep raw body for Stripe webhook if signature verification is enabled
app.use((req, _res, next) => {
  (req as any).rawBodyData = Buffer.alloc(0);
  req.on("data", (chunk) => {
    (req as any).rawBodyData = Buffer.concat([(req as any).rawBodyData, chunk]);
  });
  req.on("end", () => {
    (req as any).rawBody = (req as any).rawBodyData;
    next();
  });
});

app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));

// Configure CORS with environment variable support
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// API Routes
app.use("/health", healthRouter);
app.use("/analyze", analyzeRouter);
app.use("/billing-portal", billingPortalRouter);
app.use("/autumn", autumnRouter);

// Legacy payment routes
app.use(paymentsRouter);
app.use(postPaymentRouter);
app.use(usersRouter);

app.listen(port, () => {
  console.log(`Backend API server listening on http://localhost:${port}`);
  console.log(`Available routes:`);
  console.log(`  GET  /health`);
  console.log(`  GET  /analyze`);
  console.log(`  POST /analyze`);
  console.log(`  POST /billing-portal`);
  console.log(`  ALL  /autumn/*`);
});