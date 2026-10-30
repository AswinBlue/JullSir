// Supabase Edge Function: notify-ticket
// Triggered on ticket call to send Web Push or Resend Email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface RequestPayload {
  queueId: string;
  queueName: string;
  ticketNumber: number;
  email?: string;
  pushSubscription?: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const payload: RequestPayload = await req.json();
    const { queueName, ticketNumber, email } = payload;

    // 1. Send Email via Resend if email is provided
    if (email && Deno.env.get("RESEND_API_KEY")) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "JullSir <no-reply@jullsir.com>",
          to: [email],
          subject: `🎉 [${queueName}] #${ticketNumber}번 고객님 지금 바로 입장해 주세요!`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 16px;">
              <h2 style="color: #3182f6; margin-bottom: 8px;">JullSir(줄서) 순번 호출 안내</h2>
              <p style="font-size: 16px; color: #1e293b;">
                <strong>${queueName}</strong>의 대기번호 <strong>#${ticketNumber}번</strong> 고객님, 지금 바로 카운터로 와주세요!
              </p>
              <div style="margin: 24px 0; padding: 16px; background-color: #f8fafc; border-radius: 12px; text-align: center;">
                <span style="font-size: 32px; font-weight: 800; color: #0f172a;">#${ticketNumber}</span>
              </div>
              <p style="font-size: 13px; color: #64748b;">
                호출 후 5분 이내 미방문 시 다음 순번으로 넘어갈 수 있습니다.
              </p>
            </div>
          `,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
