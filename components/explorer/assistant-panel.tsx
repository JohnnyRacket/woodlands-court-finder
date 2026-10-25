"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import { ArrowUp, LoaderCircle, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Where can I play pickleball right now?",
  "Any lit tennis courts without a reservation tomorrow at 8 PM?",
  "When is open play at Falconwing tomorrow?",
  "Will rain get in the way this evening?",
];

const TOOL_TEXT: Record<string, string> = {
  findCourts: "Checking court availability",
  getParkSchedule: "Reading the park's schedule",
  getWeather: "Checking the forecast",
  listParks: "Looking up parks",
};

function errorText(error: Error): string {
  try {
    return (JSON.parse(error.message) as { error?: string }).error ?? error.message;
  } catch {
    return error.message || "Something went wrong.";
  }
}

export function AssistantPanel({ onClose, className }: { onClose: () => void; className?: string }) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, status]);

  const ask = (text: string) => {
    if (!text.trim() || busy) return;
    void sendMessage({ text: text.trim() });
    setInput("");
  };

  return (
    <section className={cn("glass-panel flex min-h-0 flex-col", className)} aria-label="Court Finder assistant">
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-primary text-brand-mint">
          <Sparkles className="size-4.5" />
        </span>
        <div className="flex-1 leading-tight">
          <h2 className="font-semibold text-primary">Ask Court Finder</h2>
          <p className="text-xs text-muted-foreground">Answers from live court, schedule and weather data</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition hover:bg-accent hover:text-primary"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="panel-scroll flex min-h-0 flex-1 flex-col gap-3 px-4 pb-1 mb-0!">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2 pt-1">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => ask(suggestion)}
                className="rounded-2xl bg-white/80 px-4 py-2.5 text-left text-sm shadow-xs transition hover:bg-accent hover:text-primary"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={cn("flex flex-col gap-1.5", message.role === "user" && "items-end")}>
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <p
                    key={i}
                    className={cn(
                      "max-w-[92%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                      message.role === "user" ? "bg-primary text-primary-foreground" : "bg-white/85 shadow-xs",
                    )}
                  >
                    {part.text}
                  </p>
                );
              }
              if (isToolUIPart(part)) {
                const done = part.state === "output-available" || part.state === "output-error";
                return (
                  <span key={i} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                    {done ? <Sparkles className="size-3" /> : <LoaderCircle className="size-3 animate-spin" />}
                    {TOOL_TEXT[getToolName(part)] ?? "Working"}
                  </span>
                );
              }
              return null;
            })}
          </div>
        ))}

        {status === "submitted" && (
          <span className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" /> Thinking…
          </span>
        )}
        {error && <p className="rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{errorText(error)}</p>}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-border/60 px-3 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          ask(input);
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              ask(input);
            }
          }}
          rows={1}
          placeholder="Ask about courts, open play, weather…"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-white/90 px-4 py-2.5 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        {busy ? (
          <button type="button" onClick={() => stop()} aria-label="Stop" className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-foreground transition hover:bg-accent">
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send"
            disabled={!input.trim()}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </form>
    </section>
  );
}
