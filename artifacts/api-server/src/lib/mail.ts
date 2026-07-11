import nodemailer, { type Transporter } from "nodemailer";

// Les corps d'email sont construits par interpolation de champs utilisateur
// (client, objet...) dans du HTML — sans echappement, un COMMERCIAL pourrait
// injecter du markup (lien de phishing, etc.) envoye au nom de l'entreprise
// a un vrai client externe. A utiliser sur TOUTE valeur utilisateur inseree
// dans un template html d'email.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("SMTP_HOST/SMTP_USER/SMTP_PASS non configures — envoi d'email indisponible");
    this.name = "EmailNotConfiguredError";
  }
}

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new EmailNotConfiguredError();

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendMail(input: SendMailInput): Promise<void> {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await t.sendMail({ from, to: input.to, subject: input.subject, html: input.html, attachments: input.attachments });
}
