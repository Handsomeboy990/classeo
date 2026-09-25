import "server-only";

import nodemailer from "nodemailer";

import { absoluteUrl, appUrl, readMailConfig } from "./config";
import { createMailer, type MailMessage, type MailStatus } from "./transport";

export type { MailMessage, MailStatus };

// One pooled transport per server instance, created on the first message.
const mailer = createMailer({
  config: readMailConfig(process.env),
  createTransport: (options) => nodemailer.createTransport(options),
});

// Never throws: the caller decides what to tell the user from the status.
export function sendMail(message: MailMessage): Promise<MailStatus> {
  return mailer.send(message);
}

export const mailEnabled = mailer.enabled;

export function platformUrl(path?: string) {
  return absoluteUrl(appUrl(process.env), path ?? "/");
}
