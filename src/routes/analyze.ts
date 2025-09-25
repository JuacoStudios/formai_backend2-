import { Router } from "express";
import { z } from "zod";
import multer from "multer";

// Rate limiter: 20 requests per 10 minutes per IP (best-effort; resets on redeploy)
const WINDOW_MS = 10 * 60_000; // 10 minutes
const MAX_REQS_PER_WINDOW = 20;
const counters = new Map<string, { count: number; windowStart: number }>();

function rateLimited(ip: string) {
  const now = Date.now();
  const rec = counters.get(ip);
  if (!rec) {
    counters.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (now - rec.windowStart > WINDOW_MS) {
    counters.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (rec.count >= MAX_REQS_PER_WINDOW) return true;
  rec.count += 1;
  return false;
}

// AnalyzeResponse schema (strict)
const AnalyzeResponseSchema = z.object({
  id: z.string().uuid(),
  machine: z.object({
    name: z.string(),
    confidence: z.number().min(0).max(1),
    muscles: z.object({
      primary: z.array(z.string()),
      secondary: z.array(z.string()),
    }),
  }),
  howItWorks: z.string(),
  steps: z.array(z.string()),
  safetyRisks: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  alternatives: z.array(z.string()),
  quickCoach: z.string(),
  rawModelNotes: z.string().optional(),
  createdAt: z.string(),
});

// Helper: safe parse, and if missing id/createdAt, fill and re-validate
function coerceAnalyzeResponse(raw: unknown) {
  const withDefaults = (() => {
    try {
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!obj || typeof obj !== "object") return raw;
      const o = obj as any;
      if (!o.id) o.id = crypto.randomUUID();
      if (!o.createdAt) o.createdAt = new Date().toISOString();
      return o;
    } catch {
      return raw;
    }
  })();
  const parsed = AnalyzeResponseSchema.safeParse(withDefaults);
  if (!parsed.success) return { ok: false as const, error: parsed.error.format() };
  return { ok: true as const, data: parsed.data };
}

// Canonicalize common exercise names to improve consistency (e.g., bench press)
function canonicalizeExerciseName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("bench press")) {
    if (n.includes("incline")) return "Incline Barbell Bench Press";
    if (n.includes("decline")) return "Decline Barbell Bench Press";
    return "Barbell Bench Press";
  }
  if (n.includes("chest press")) return "Chest Press Machine";
  if (n.includes("lat pulldown") || n.includes("lat pull-down")) return "Lat Pulldown";
  return name;
}

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET kept for quick info (legacy), prefer /health for diagnostics
router.get("/", (req, res) => {
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  res.json({ 
    ok: true, 
    hasKey, 
    model: process.env.OPENAI_MODEL || "gpt-4o", 
    limits: { per10min: MAX_REQS_PER_WINDOW } 
  });
});

router.post("/", upload.single("image"), async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || "anon";
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "Rate limit exceeded. Please wait and try again." });
  }

  // Accept both multipart/form-data and JSON for flexibility
  let imageDataUrl: string | null = null;
  let userNote: string | undefined;
  let demo = false;

  try {
    if (req.file) {
      // Handle multipart/form-data
      const base64 = req.file.buffer.toString("base64");
      const mime = req.file.mimetype || "image/jpeg";
      imageDataUrl = `data:${mime};base64,${base64}`;
      userNote = req.body.userNote;
      demo = req.body.demo === "1" || req.body.demo === "true";
    } else {
      // Handle JSON
      const body = req.body;
      if (body?.image) imageDataUrl = body.image;
      userNote = body?.userNote;
      demo = body?.demo === true || req.query.demo === "1";
    }
  } catch (error) {
    return res.status(400).json({ error: "Invalid request format" });
  }

  if (!imageDataUrl) {
    return res.status(422).json({ error: "Missing image in request." });
  }

  // Demo mode fast path
  if (demo) {
    const mock = {
      id: crypto.randomUUID(),
      machine: {
        name: "Barbell Bench Press",
        confidence: 0.92,
        muscles: { primary: ["Pectoralis major"], secondary: ["Anterior deltoids", "Triceps brachii"] },
      },
      howItWorks: "A flat bench and barbell setup where you press the barbell from chest level to arm's length to train the chest, shoulders, and triceps.",
      steps: [
        "Set the bar at a height where you can unrack with a slight elbow bend; load appropriate weight and add collars.",
        "Lie on the bench with eyes under the bar, feet planted, slight arch, and shoulder blades retracted.",
        "Grip the bar slightly wider than shoulder width; wrists straight and forearms vertical when the bar is on the chest.",
        "Unrack, bring the bar over mid‑chest, inhale and lower under control to lightly touch the lower chest/sternum.",
        "Drive the bar back up by pressing through the chest and triceps, exhaling as you pass the sticking point.",
        "Lock out without hyperextending elbows; re-rack by guiding the bar back to the hooks with control.",
      ],
      safetyRisks: [
        "Avoid flared elbows at 90°; keep ~45–70° to protect shoulders.",
        "Do not bounce the bar off the chest; pause lightly before pressing.",
        "Use spotter or safety arms; never max alone.",
        "Keep feet planted; avoid lifting hips off the bench.",
      ],
      commonMistakes: [
        "Overly wide grip reducing range of motion.",
        "Letting wrists bend back excessively.",
        "Butt lifting off bench to cheat the rep.",
        "Bar path straight up/down instead of slight J‑curve toward shoulders.",
      ],
      alternatives: ["Dumbbell Bench Press", "Incline Barbell Bench Press", "Machine Chest Press", "Push‑ups"],
      quickCoach: "Set scapular retraction, light chest touch, and a controlled 2–3s lower. Drive through the feet, keep wrists stacked, and elbows ~60°.",
      createdAt: new Date().toISOString(),
    };
    const ok = coerceAnalyzeResponse(mock);
    // apply canonicalization in demo too
    if (ok.ok) ok.data.machine.name = canonicalizeExerciseName(ok.data.machine.name);
    return ok.ok ? res.json(ok.data) : res.status(500).json({ error: "Validation failed", details: ok.error });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Server missing OPENAI_API_KEY. Configure it and redeploy." });
  }

  // Build system/user prompts per spec
  const systemPrompt = `You are FormAI, a concise, friendly, safety-first gym assistant.
Given a photo of a gym machine OR free-weight setup, identify the exact common exercise name and coach the user:
1) Name the machine/exercise (use canonical, widely-used names). Prefer classic compound names. Examples:
   - Free-weight barbell on a flat bench with rack/spotter arms -> "Barbell Bench Press"
   - Bench + barbell angled upward -> "Incline Barbell Bench Press"
   - Seated cable with high pulley and wide bar -> "Lat Pulldown"
2) Which muscles are targeted (primary/secondary).
3) Explain how the machine works.
4) Provide beginner-friendly, step-by-step usage instructions.
5) List safety risks and how to avoid them.
6) List common mistakes.
7) Recommend alternative machines/exercises for similar goals.
8) Provide a brief "quick coaching" summary (2-3 lines).

Strict output rules:
- Output MUST be valid JSON only that matches exactly this TypeScript type:
  type AnalyzeResponse = {
    id: string;
    machine: { name: string; confidence: number; muscles: { primary: string[]; secondary: string[] } };
    howItWorks: string;
    steps: string[];
    safetyRisks: string[];
    commonMistakes: string[];
    alternatives: string[];
    quickCoach: string;
    createdAt: string;
  };
- Prefer canonical names (e.g., "Barbell Bench Press" instead of generic "Chest Press").
- If uncertain or image is ambiguous, set machine.name = "Unknown" and confidence = 0, and include safetyRisks = ["Image unclear or not a gym machine"].`;

  const userText = [
    userNote ? `User note: ${userNote}` : null,
    "Return only JSON. No extra text.",
  ].filter(Boolean).join("\n");

  // Timeout controller (25s)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => "");
      return res.status(500).json({ error: `OpenAI error: ${openaiRes.status} ${errText}` });
    }

    const data = await openaiRes.json();
    let content = data.choices?.[0]?.message?.content as string | undefined;

    // First parse attempt
    let first = coerceAnalyzeResponse(content ?? "");

    if (!first.ok) {
      // Retry once with guardrail
      const retry = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: [{ type: "text", text: "Return valid JSON ONLY that matches the AnalyzeResponse type." }] },
            { role: "user", content: [{ type: "image_url", image_url: { url: imageDataUrl } }] },
          ],
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!retry.ok) {
        const errText = await retry.text().catch(() => "");
        return res.status(500).json({ error: `OpenAI error: ${retry.status} ${errText}` });
      }
      const rj = await retry.json();
      content = rj.choices?.[0]?.message?.content;
      first = coerceAnalyzeResponse(content ?? "");
    }

    if (!first.ok) {
      return res.status(500).json({ error: "Failed to parse/validate AI JSON output.", details: first.error });
    }

    // Apply canonicalization before returning
    const out = first.data;
    out.machine.name = canonicalizeExerciseName(out.machine.name);

    return res.json(out);
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return res.status(500).json({ 
      error: aborted ? "AI request timed out. Please retry." : (err?.message || "Unknown server error") 
    });
  } finally {
    clearTimeout(timeout);
  }
});

export { router as analyzeRouter };
