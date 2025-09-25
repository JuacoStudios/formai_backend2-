import { Router } from "express";
import { getEntitlements } from "../db.js";

export const usersRouter = Router();

usersRouter.get("/users/:id/entitlements", (req, res) => {
  const { id } = req.params;
  const ent = getEntitlements(id);
  res.json(ent);
});