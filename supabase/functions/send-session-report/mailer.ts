/**
 * Email delivery via Resend (brief Section 9). The `SendEmail` type is the seam
 * the tests mock — `resendSender` is the real implementation, and tests pass a
 * stub to assert the message shape without hitting the network.
 */

export type EmailAttachment = {
  filename: string;
  /** Base64-encoded contents. */
  content: string;
  contentType?: string;
};

export type EmailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: EmailAttachment[];
};

export type SendEmail = (message: EmailMessage) => Promise<void>;

/** Real Resend sender. Throws on a non-2xx response so callers can surface it. */
export function resendSender(apiKey: string): SendEmail {
  return async (message) => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        attachments: message.attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          content_type: a.contentType,
        })),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Resend send failed (${response.status}): ${detail}`);
    }
  };
}
