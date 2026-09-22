"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

// Stage 9 demo entry point: this system has no real WhatsApp Business
// integration (StubWhatsAppProvider only — see provider doc comments).
// This form sends an inbound message to the REAL /api/whatsapp/webhook
// exactly as a real WhatsApp inbound message would, so the entire
// Lead/conversation/AI-reply/classification pipeline runs unmodified —
// only the "customer sent this" trigger is simulated here, nothing about
// the backend flow is faked.
export function SimulateWhatsAppForm({
  campaignId,
  defaultPhone,
  lockPhone = false,
}: {
  campaignId: string;
  defaultPhone?: string;
  lockPhone?: boolean;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, phone, message }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof body?.error === "string" ? body.error : "Could not simulate this message. Please try again.");
        return;
      }

      setMessage("");
      const leadId = body?.lead?.id;
      if (leadId) {
        router.push(`/campaigns/${campaignId}/leads/${leadId}`);
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        id="phone"
        label="Customer phone"
        type="text"
        required
        value={phone}
        disabled={lockPhone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+60123456789"
      />
      <Textarea
        id="message"
        label="Message (as the customer)"
        required
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="e.g. Hi, I'd like to know more about this plan"
      />
      {error && <ErrorState message={error} />}
      <div>
        <Button type="submit" isLoading={submitting}>
          {submitting ? "Sending…" : "Simulate WhatsApp Message (stub)"}
        </Button>
      </div>
    </form>
  );
}
