import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  res.json({ 
    ok: true, 
    hasKey, 
    model: process.env.OPENAI_MODEL || "gpt-4o-mini" 
  });
});

export { router as healthRouter };
