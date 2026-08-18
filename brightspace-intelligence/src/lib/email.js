import net from "node:net";
import tls from "node:tls";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

export function themedEmailShell({ eyebrow, title, intro, rows = [], bodyBlocks = [], buttonLabel, buttonUrl, footerNote }) {
  const renderedRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px 8px 0;color:#245C4F;vertical-align:top;width:42%;word-break:break-word;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:#063F32;vertical-align:top;width:58%;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(value || "-")}</td>
        </tr>
      `
    )
    .join("");
  const renderedBodyBlocks = bodyBlocks
    .map((block) => `<div style="margin-top:18px;line-height:1.7;color:#245C4F;font-size:15px;">${block}</div>`)
    .join("");

  return `
    <div style="margin:0;padding:0;background:radial-gradient(circle at top left,rgba(201,162,39,.14),transparent 28%),radial-gradient(circle at top right,rgba(45,138,106,.14),transparent 26%),linear-gradient(180deg,#FAF7F0 0%,#F7F1E3 100%);font-family:Arial,sans-serif;color:#063F32;">
      <div style="max-width:720px;margin:0 auto;padding:32px 20px;">
        <div style="background:linear-gradient(135deg,rgba(13,59,46,.98),rgba(13,92,72,.94));border:1px solid #2D8A6A;border-radius:28px;overflow:hidden;box-shadow:0 24px 80px rgba(13,59,46,.18);">
          <div style="padding:28px 28px 20px;color:#FAF7F0;">
            <p style="margin:0 0 10px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#E4C766;font-weight:700;">${escapeHtml(eyebrow)}</p>
            <h1 style="margin:0;font-size:28px;line-height:1.2;color:#FAF7F0;">${escapeHtml(title)}</h1>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#EAF6EF;">${escapeHtml(intro)}</p>
          </div>
          <div style="padding:28px;background:rgba(250,247,240,.98);">
            <div style="border:1px solid #2D8A6A;border-radius:22px;padding:18px;background:#fffaf0;overflow:hidden;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:14px;table-layout:fixed;">
                ${renderedRows}
              </table>
            </div>
            ${renderedBodyBlocks}
            ${buttonLabel && buttonUrl ? `
              <div style="margin:28px 0 0;text-align:center;">
                <a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#0D5C48;color:#FAF7F0;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;font-size:14px;">${escapeHtml(buttonLabel)}</a>
              </div>
            ` : ""}
            ${footerNote ? `<p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#245C4F;">${escapeHtml(footerNote)}</p>` : ""}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function buildFeeVoucherEmailHtml({
  studentName,
  voucherNo,
  amount,
  dueDate,
  portalUrl,
}) {
  const safeStudentName = escapeHtml(studentName);
  const safeVoucherNo = escapeHtml(voucherNo);
  const safeAmount = escapeHtml(amount);
  const safeDueDate = escapeHtml(formatDate(dueDate));
  const safePortalUrl = escapeHtml(portalUrl);

  return themedEmailShell({
    eyebrow: "LMS Voucher Ready",
    title: "Your fee voucher is available",
    intro: `Hello, ${studentName}. Your fee voucher has been created and is ready for review. Please use the secure portal link below to view the invoice and upload payment proof when you are ready.`,
    rows: [
      ["Student", safeStudentName],
      ["Voucher No", safeVoucherNo],
      ["Amount", safeAmount],
      ["Due Date", safeDueDate],
    ],
    buttonLabel: "Open Voucher",
    buttonUrl: safePortalUrl,
    footerNote: `If the button does not work, open this link in your browser: ${portalUrl}`,
  });
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLineEndings(value) {
  return String(value || "").replace(/\r?\n/g, "\r\n");
}

function encodeBase64(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function readSmtpResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n");
      const lastLine = lines[lines.length - 1];
      const completeLines = lines.slice(0, -1).filter(Boolean);
      const pendingLine = completeLines.at(-1) || lastLine || "";
      const match = pendingLine.match(/^(\d{3})([ -])/);

      if (!match) return;

      const code = Number(match[1]);
      const isFinal = match[2] === " ";
      if (!isFinal) return;

      socket.off("data", onData);
      socket.off("error", onError);
      resolve({ code, message: buffer.trim() });
    };

    const onError = (error) => {
      socket.off("data", onData);
      socket.off("error", onError);
      reject(error);
    };

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function writeCommand(socket, command) {
  socket.write(`${command}\r\n`);
  return readSmtpResponse(socket);
}

function awaitSocketReady(socket, eventName) {
  return new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.once(eventName, resolve);
  });
}

async function sendViaSmtp({ to, subject, html, text }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromAddress = process.env.SMTP_FROM || user;
  const fromName = process.env.SMTP_FROM_NAME || "LMS Platform";

  if (!host || !user || !pass || !fromAddress) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.");
  }

  const destination = String(to || "").trim();
  const sender = `"${fromName.replace(/"/g, '\\"')}" <${fromAddress}>`;
  const subjectLine = String(subject || "").replace(/\r?\n/g, " ").trim();
  const bodyText = text || stripHtml(html);
  const boundary = `boundary_${Date.now()}`;
  const message = [
    `From: ${sender}`,
    `To: ${destination}`,
    `Subject: ${subjectLine}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    bodyText,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const useTls = port === 465;
  let socket = useTls ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });

  await awaitSocketReady(socket, useTls ? "secureConnect" : "connect");

  let response = await readSmtpResponse(socket);
  if (response.code !== 220) {
    socket.end();
    throw new Error(`SMTP connection failed: ${response.message}`);
  }

  response = await writeCommand(socket, `EHLO ${host}`);
  if (response.code !== 250) {
    socket.end();
    throw new Error(`SMTP EHLO failed: ${response.message}`);
  }

  if (!useTls) {
    response = await writeCommand(socket, "STARTTLS");
    if (response.code !== 220) {
      socket.end();
      throw new Error(`SMTP STARTTLS failed: ${response.message}`);
    }

    socket = tls.connect({ socket, servername: host });
    await awaitSocketReady(socket, "secureConnect");

    response = await writeCommand(socket, `EHLO ${host}`);
    if (response.code !== 250) {
      socket.end();
      throw new Error(`SMTP EHLO after STARTTLS failed: ${response.message}`);
    }
  }

  response = await writeCommand(socket, `AUTH LOGIN`);
  if (response.code !== 334) {
    socket.end();
    throw new Error(`SMTP AUTH LOGIN failed: ${response.message}`);
  }

  response = await writeCommand(socket, encodeBase64(user));
  if (response.code !== 334) {
    socket.end();
    throw new Error(`SMTP username rejected: ${response.message}`);
  }

  response = await writeCommand(socket, encodeBase64(pass));
  if (response.code !== 235) {
    socket.end();
    throw new Error(`SMTP password rejected: ${response.message}`);
  }

  response = await writeCommand(socket, `MAIL FROM:<${fromAddress}>`);
  if (response.code !== 250) {
    socket.end();
    throw new Error(`SMTP MAIL FROM failed: ${response.message}`);
  }

  response = await writeCommand(socket, `RCPT TO:<${destination}>`);
  if (response.code !== 250 && response.code !== 251) {
    socket.end();
    throw new Error(`SMTP RCPT TO failed: ${response.message}`);
  }

  response = await writeCommand(socket, "DATA");
  if (response.code !== 354) {
    socket.end();
    throw new Error(`SMTP DATA failed: ${response.message}`);
  }

  socket.write(`${normalizeLineEndings(message).replace(/^\./gm, "..")}\r\n.\r\n`);
  response = await readSmtpResponse(socket);
  if (response.code !== 250) {
    socket.end();
    throw new Error(`SMTP message send failed: ${response.message}`);
  }

  await writeCommand(socket, "QUIT").catch(() => null);
  socket.end();
  return true;
}

export async function sendEmail({ to, subject, html, text }) {
  const destination = String(to || "").trim();
  if (!destination) {
    throw new Error("Recipient email is required.");
  }

  return sendViaSmtp({ to: destination, subject, html, text });
}

export function buildCredentialsEmailHtml({
  recipientName,
  studentName,
  parentLogin,
  parentPassword,
  studentLogin,
  studentPassword,
  portalUrl,
  isExistingParent = false,
}) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeStudentName = escapeHtml(studentName);
  const safeParentLogin = escapeHtml(parentLogin);
  const safeStudentLogin = escapeHtml(studentLogin);
  const safeStudentPassword = escapeHtml(studentPassword);
  const safePortalUrl = escapeHtml(portalUrl);
  const safeParentPassword = parentPassword ? escapeHtml(parentPassword) : "";

  const rows = [["Parent Login", safeParentLogin]];

  if (!isExistingParent && safeParentPassword) {
    rows.push(["Parent Temporary Password", safeParentPassword]);
  }

  rows.push(
    ["Student Login", safeStudentLogin],
    ["Student Temporary Password", safeStudentPassword]
  );

  const importantMessage = isExistingParent
    ? "Your existing parent login stays the same. Only the new student account below uses a temporary password."
    : "You will be asked to change the temporary passwords after sign in.";

  return themedEmailShell({
    eyebrow: "LMS Access Granted",
    title: "Your LMS accounts are ready",
    intro: isExistingParent
      ? `Hello, ${recipientName}. Payment has been verified for ${studentName}. Your parent account is already active, and a new student account has been added below.`
      : `Hello, ${recipientName}. Payment has been verified for ${studentName}. Your login credentials are ready below.`,
    rows,
    bodyBlocks: [
      `<div style="padding:16px;border:1px solid #2D8A6A;border-radius:18px;background:#fffaf0;"><p style="margin:0 0 6px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#0D5C48;font-weight:700;">Important</p><p style="margin:0;line-height:1.8;color:#245C4F;font-size:15px;">${escapeHtml(importantMessage)}</p></div>`,
    ],
    buttonLabel: "Open LMS",
    buttonUrl: safePortalUrl,
    footerNote: "If the button does not work, open this link in your browser: " + safePortalUrl,
  });
}

export function buildPaymentDecisionEmailHtml({
  title,
  eyebrow,
  intro,
  voucherNo,
  reason,
  portalUrl,
  ctaLabel = "Open LMS",
}) {
  return themedEmailShell({
    eyebrow,
    title,
    intro,
    rows: voucherNo ? [["Voucher No", voucherNo]] : [],
    bodyBlocks: reason
      ? [
          `<div style="padding:16px;border:1px solid #2D8A6A;border-radius:18px;background:#fffaf0;"><p style="margin:0 0 6px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#0D5C48;font-weight:700;">Message</p><p style="margin:0;line-height:1.8;color:#245C4F;font-size:15px;">${escapeHtml(reason)}</p></div>`,
        ]
      : [],
    buttonLabel: ctaLabel,
    buttonUrl: portalUrl,
    footerNote: `If the button does not work, open this link in your browser: ${portalUrl}`,
  });
}

export function buildLectureJoinEmailHtml({
  recipientName,
  lectureTitle,
  studentName,
  subjectName,
  scheduledStart,
  portalUrl,
  meetLink,
}) {
  const safeRecipientName = escapeHtml(recipientName || "Learner");
  const safeLectureTitle = escapeHtml(lectureTitle);
  const safeStudentName = escapeHtml(studentName);
  const safeSubjectName = escapeHtml(subjectName);
  const safeScheduledStart = escapeHtml(
    scheduledStart
      ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(scheduledStart))
      : ""
  );
  const safePortalUrl = escapeHtml(portalUrl);
  const safeMeetLink = escapeHtml(meetLink);

  return themedEmailShell({
    eyebrow: "Lecture Link Available",
    title: "Your lecture joining link is available in the portal",
    intro: `Hello, ${recipientName}. A lecture has been scheduled. You can open the LMS portal to view the class details and join during the scheduled class window.`,
    rows: [
      ["Lecture", safeLectureTitle],
      ["Student", safeStudentName],
      ["Subject", safeSubjectName],
      ["Schedule", safeScheduledStart],
    ],
    buttonLabel: "Open Portal",
    buttonUrl: safePortalUrl,
    footerNote: `Direct Meet link: ${meetLink}`,
  });
}

export function getAppUrl() {
  return getBaseUrl();
}
