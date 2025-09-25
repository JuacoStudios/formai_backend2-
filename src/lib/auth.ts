import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { db } from "./db.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {    
    enabled: true
  },
  plugins: [bearer()]
});

// Session validation helper
export async function getCurrentUser(headers: any) {
  const session = await auth.api.getSession({ headers });
  return session?.user || null;
}
