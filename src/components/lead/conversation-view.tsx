import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type ConversationMessage = {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  createdAt: string;
};

// Same bubble logic both Lead detail routes share — extracted so there's
// one implementation, not two copies. Outbound bubbles use the accent tint
// rather than a generic blue-100, so the one indigo the product uses shows
// up here deliberately (a real message from "us") instead of as decoration.
export function ConversationView({ messages }: { messages: ConversationMessage[] }) {
  return (
    <Card title="WhatsApp conversation" action={<Badge>Stub provider — no real message sent</Badge>}>
      {messages.length === 0 ? (
        <p className="text-sm text-muted">No messages yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-[14px] px-3.5 py-2.5 text-sm ${
                m.direction === "inbound"
                  ? "self-start bg-surface-muted text-foreground"
                  : "self-end bg-accent-subtle text-accent-ink"
              }`}
            >
              <p className="mb-0.5 text-xs opacity-60">{m.direction === "inbound" ? "Customer" : "AI (stub)"}</p>
              <p>{m.content}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
