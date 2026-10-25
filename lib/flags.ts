// Feature flags. NEXT_PUBLIC_ values are baked in at build time, so the client and the
// route handlers always agree; changing one means rebuilding.

/** The AI assistant: the "Ask" button and /api/chat. Off until it's ready. */
export const assistantEnabled = process.env.NEXT_PUBLIC_ASSISTANT_ENABLED === "true";
