import { readFile, writeFile } from "node:fs/promises";
import { connect as connectTcp } from "node:net";
import { basename, join } from "node:path";
import { connect as connectTls } from "node:tls";

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
const log = (level, message) => emit({ type: "log", level, message });
const progress = (value, label) => emit({ type: "progress", value: Math.max(0, Math.min(1, value)), label });
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let activeClient;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    activeClient?.close();
    log("warning", "Campaign cancelled. Messages already accepted by the SMTP server cannot be recalled.");
    process.exitCode = 130;
  });
}

async function execute(raw) {
  try {
    const request = JSON.parse(raw);
    const settings = normalizeConfig(request.config);
    const input = normalizeInput(request.input);
    const csvFile = request.files?.find((file) => file.name === input.csvFileName) ?? request.files?.[0];
    if (!csvFile) throw new Error("Choose a recipient CSV file.");

    log("info", `Reading recipients from ${safeLogName(csvFile.name)}.`);
    const rows = parseCsv(await readFile(csvFile.path, "utf8"));
    const recipients = normalizeRecipients(rows);
    if (!recipients.length) throw new Error("The CSV does not contain any valid recipient rows.");
    const attachments = await Promise.all(
      (request.files ?? [])
        .filter((file) => file.path !== csvFile.path)
        .map(async (file) => ({
          ...file,
          filename: safeAttachmentName(file.name),
          data: await readFile(file.path),
        })),
    );
    const selected = input.mode === "test" ? [{ ...recipients[0], email: input.testRecipient }] : recipients;

    log(
      "info",
      input.mode === "test" ? "Preparing one test message." : `Preparing ${selected.length} personalized messages.`,
    );
    if (attachments.length)
      log("info", `Attaching ${attachments.length} local file${attachments.length === 1 ? "" : "s"}.`);
    progress(0.03, "Connecting to SMTP server");
    activeClient = await SmtpClient.open(settings);
    log("success", `Connected to ${settings.host}:${settings.port} using ${settings.security.toUpperCase()}.`);
    await activeClient.authenticate(settings.username, settings.password);
    log("success", "SMTP authentication succeeded.");

    const report = [];
    for (const [index, recipient] of selected.entries()) {
      const number = index + 1;
      progress(0.08 + (index / selected.length) * 0.86, `Sending ${number} of ${selected.length}`);
      try {
        const message = await createMessage({ input, settings, recipient, attachments });
        const response = await activeClient.send(settings.senderEmail, recipient.email, message);
        report.push({ email: recipient.email, status: "sent", response });
        log("success", `Accepted ${number}/${selected.length}: ${recipient.email}`);
      } catch (error) {
        const message = publicError(error);
        report.push({ email: recipient.email, status: "failed", error: message });
        log("error", `Failed ${number}/${selected.length}: ${recipient.email} — ${message}`);
        await activeClient.reset().catch(() => undefined);
      }
      if (input.mode === "campaign" && number < selected.length && input.delayMs > 0) await sleep(input.delayMs);
    }

    await activeClient.quit();
    activeClient = undefined;
    const sent = report.filter((item) => item.status === "sent").length;
    const failed = report.length - sent;
    const reportName = input.mode === "test" ? "smtp-test-report.csv" : "smtp-campaign-report.csv";
    await writeFile(join(request.outputDir, reportName), reportCsv(report), "utf8");
    log(failed ? "warning" : "success", `Finished with ${sent} sent and ${failed} failed.`);
    emit({
      type: "result",
      outputs: [
        {
          path: reportName,
          name: reportName,
          mimeType: "text/csv",
          metadata: { sent, failed, total: report.length, mode: input.mode },
        },
      ],
      data: { sent, failed, total: report.length, mode: input.mode },
    });
    progress(1, "Complete");
  } catch (error) {
    activeClient?.close();
    activeClient = undefined;
    const message = publicError(error);
    log("error", message);
    emit({ type: "failed", message });
    process.exitCode = 1;
  }
}

function normalizeConfig(value) {
  const host = String(value?.smtpHost ?? "").trim();
  const port = Number(value?.smtpPort);
  const security = new Set(["starttls", "tls", "none"]).has(value?.smtpSecurity) ? value.smtpSecurity : "starttls";
  const username = String(value?.smtpUsername ?? "").trim();
  const password = String(value?.smtpPassword ?? "");
  const senderEmail = validEmail(value?.senderEmail, "From email");
  const senderName = cleanHeader(value?.senderName ?? "", "From name");
  const replyTo = validEmail(value?.replyTo || senderEmail, "Reply-to email");
  if (!host || /[\s/]/.test(host)) throw new Error("SMTP host is invalid.");
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("SMTP port is invalid.");
  if (!username) throw new Error("SMTP username is required.");
  if (!password) throw new Error("SMTP password is required.");
  return { host, port, security, username, password, senderEmail, senderName, replyTo };
}

function normalizeInput(value) {
  if (value?.authorized !== true)
    throw new Error("Confirm that you may contact these recipients and will honor opt-out requests.");
  const mode = value?.mode === "test" ? "test" : "campaign";
  const subject = String(value?.subject ?? "").trim();
  const textBody = String(value?.textBody ?? "").trim();
  const htmlBody = String(value?.htmlBody ?? "").trim();
  const csvFileName = String(value?.csvFileName ?? "");
  const testRecipient = mode === "test" ? validEmail(value?.testRecipient, "Test recipient") : "";
  const delayMs = Math.round(Number(value?.delayMs));
  if (!subject) throw new Error("Add an email subject.");
  if (!textBody && !htmlBody) throw new Error("Add a plain-text or HTML message.");
  if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > 3_600_000)
    throw new Error("Delay must be between 0 and 3,600,000 milliseconds.");
  return { mode, subject, textBody, htmlBody, csvFileName, testRecipient, delayMs };
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("The recipient CSV contains an unclosed quoted field.");
  row.push(field.replace(/\r$/, ""));
  if (row.some((item) => item.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("The recipient CSV needs a header and at least one data row.");
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length)
    throw new Error("CSV column names must be unique.");
  return rows
    .slice(1)
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function normalizeRecipients(rows) {
  const seen = new Set();
  const recipients = [];
  for (const row of rows) {
    const emailKey = Object.keys(row).find((key) => key.toLowerCase() === "email");
    if (!emailKey) throw new Error('The recipient CSV must contain an "email" column.');
    const email = String(row[emailKey]).trim().toLowerCase();
    if (!isEmail(email) || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ ...row, email });
  }
  return recipients;
}

async function createMessage({ input, settings, recipient, attachments }) {
  const boundary = `sf-mixed-${crypto.randomUUID()}`;
  const alternative = `sf-alt-${crypto.randomUUID()}`;
  const subject = cleanHeader(renderTemplate(input.subject, recipient, false), "Subject");
  const text = renderTemplate(input.textBody, recipient, false);
  const html = renderTemplate(input.htmlBody, recipient, true);
  const from = settings.senderName
    ? `${encodeHeader(settings.senderName)} <${settings.senderEmail}>`
    : settings.senderEmail;
  const headers = [
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${settings.senderEmail.split("@")[1]}>`,
    `From: ${from}`,
    `To: ${recipient.email}`,
    `Reply-To: ${settings.replyTo}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `List-Unsubscribe: <mailto:${settings.replyTo}?subject=unsubscribe>`,
  ];
  const footer = '\n\nTo opt out, reply with "unsubscribe".';
  const htmlFooter = '<p style="color:#666;font-size:12px">To opt out, reply with “unsubscribe”.</p>';
  const contentParts = [];
  if (text && html) {
    contentParts.push(
      `Content-Type: multipart/alternative; boundary="${alternative}"\r\n\r\n` +
        `--${alternative}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(text + footer)}\r\n` +
        `--${alternative}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(html + htmlFooter)}\r\n` +
        `--${alternative}--`,
    );
  } else if (html) {
    contentParts.push(
      `Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(html + htmlFooter)}`,
    );
  } else {
    contentParts.push(
      `Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(text + footer)}`,
    );
  }
  if (!attachments.length) return `${headers.join("\r\n")}\r\n${contentParts[0]}\r\n`;
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  const parts = [`--${boundary}\r\n${contentParts[0]}`];
  for (const attachment of attachments) {
    parts.push(
      `--${boundary}\r\nContent-Type: ${attachment.type || "application/octet-stream"}; name="${attachment.filename}"\r\n` +
        `Content-Disposition: attachment; filename="${attachment.filename}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(attachment.data)}`,
    );
  }
  parts.push(`--${boundary}--`);
  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}\r\n`;
}

function renderTemplate(template, values, escapeHtmlValues) {
  return String(template ?? "").replace(/{{\s*([^{}]+?)\s*}}/g, (_match, key) => {
    const found = Object.keys(values).find((candidate) => candidate.toLowerCase() === String(key).toLowerCase());
    const value = found ? String(values[found] ?? "") : "";
    return escapeHtmlValues ? escapeHtml(value) : value;
  });
}

class SmtpClient {
  constructor(socket, settings) {
    this.socket = socket;
    this.settings = settings;
    this.reader = new LineReader(socket);
  }

  static async open(settings) {
    let socket = settings.security === "tls" ? await openTls(settings) : await openTcp(settings);
    let client = new SmtpClient(socket, settings);
    await client.expect(undefined, [220]);
    let capabilities = await client.ehlo();
    if (settings.security === "starttls") {
      if (!capabilities.includes("STARTTLS")) throw new Error("This SMTP server does not advertise STARTTLS.");
      await client.expect("STARTTLS", [220]);
      client.reader.detach();
      socket = await upgradeTls(socket, settings);
      client = new SmtpClient(socket, settings);
      capabilities = await client.ehlo();
    }
    client.capabilities = capabilities;
    return client;
  }

  async ehlo() {
    const reply = await this.command(`EHLO ${localName()}`, [250]);
    return reply.lines
      .slice(1)
      .map((line) => line.slice(4).trim().toUpperCase())
      .join(" ");
  }

  async authenticate(username, password) {
    if (this.capabilities.includes("AUTH PLAIN")) {
      await this.command(`AUTH PLAIN ${Buffer.from(`\0${username}\0${password}`).toString("base64")}`, [235], true);
      return;
    }
    await this.command("AUTH LOGIN", [334]);
    await this.command(Buffer.from(username).toString("base64"), [334], true);
    await this.command(Buffer.from(password).toString("base64"), [235], true);
  }

  async send(from, to, message) {
    await this.command(`MAIL FROM:<${from}>`, [250]);
    await this.command(`RCPT TO:<${to}>`, [250, 251]);
    await this.command("DATA", [354]);
    const normalized = message.replace(/\r?\n/g, "\r\n");
    const stuffed = normalized.replace(/(^|\r\n)\./g, "$1..");
    this.socket.write(`${stuffed.replace(/\r\n$/, "")}\r\n.\r\n`);
    const reply = await this.expect(undefined, [250]);
    return reply.lines.at(-1).slice(4).trim().slice(0, 180);
  }

  async reset() {
    await this.command("RSET", [250]);
  }

  async quit() {
    await this.command("QUIT", [221]).catch(() => undefined);
    this.close();
  }

  close() {
    this.reader?.detach();
    this.socket?.destroy();
  }

  async command(command, codes, sensitive = false) {
    if (!sensitive && !command.startsWith("AUTH")) log("info", `SMTP ${command.split(" ")[0]}`);
    this.socket.write(`${command}\r\n`);
    return this.expect(undefined, codes);
  }

  async expect(_command, codes) {
    const reply = await this.reader.reply();
    if (!codes.includes(reply.code)) throw new SmtpError(reply.code, reply.lines.at(-1).slice(4).trim());
    return reply;
  }
}

class LineReader {
  constructor(socket) {
    this.socket = socket;
    this.buffer = "";
    this.lines = [];
    this.waiters = [];
    this.error = undefined;
    this.onData = (chunk) => {
      this.buffer += chunk.toString("utf8");
      const parts = this.buffer.split(/\r?\n/);
      this.buffer = parts.pop() ?? "";
      for (const line of parts) this.push(line);
    };
    this.onError = (error) => this.fail(error);
    this.onClose = () => this.fail(new Error("The SMTP connection closed unexpectedly."));
    socket.on("data", this.onData);
    socket.on("error", this.onError);
    socket.on("close", this.onClose);
  }

  push(line) {
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve(line);
    else this.lines.push(line);
  }

  fail(error) {
    this.error = error;
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }

  async line() {
    if (this.lines.length) return this.lines.shift();
    if (this.error) throw this.error;
    return await new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  async reply() {
    const first = await this.line();
    const match = /^(\d{3})([ -])/.exec(first);
    if (!match) throw new Error("The SMTP server returned an invalid response.");
    const lines = [first];
    while (lines.at(-1).startsWith(`${match[1]}-`)) lines.push(await this.line());
    return { code: Number(match[1]), lines };
  }

  detach() {
    this.socket.off("data", this.onData);
    this.socket.off("error", this.onError);
    this.socket.off("close", this.onClose);
  }
}

class SmtpError extends Error {
  constructor(code, message) {
    super(`SMTP ${code}: ${message || "The server rejected the command."}`);
    this.code = code;
  }
}

function openTcp(settings) {
  return new Promise((resolve, reject) => {
    const socket = connectTcp({ host: settings.host, port: settings.port });
    socket.setTimeout(30_000, () => socket.destroy(new Error("The SMTP connection timed out.")));
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function openTls(settings) {
  return new Promise((resolve, reject) => {
    const socket = connectTls({ host: settings.host, port: settings.port, servername: settings.host });
    socket.setTimeout(30_000, () => socket.destroy(new Error("The SMTP connection timed out.")));
    socket.once("secureConnect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function upgradeTls(socket, settings) {
  return new Promise((resolve, reject) => {
    const secure = connectTls({ socket, servername: settings.host });
    secure.setTimeout(30_000, () => secure.destroy(new Error("The SMTP connection timed out.")));
    secure.once("secureConnect", () => resolve(secure));
    secure.once("error", reject);
  });
}

function localName() {
  return "localhost";
}

function validEmail(value, label) {
  const email = String(value ?? "").trim();
  if (!isEmail(email)) throw new Error(`${label} is invalid.`);
  return email;
}

function isEmail(value) {
  return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(String(value ?? "")) && !/[\r\n]/.test(String(value));
}

function cleanHeader(value, label) {
  const text = String(value ?? "").trim();
  if (/[\r\n]/.test(text)) throw new Error(`${label} cannot contain line breaks.`);
  return text;
}

function encodeHeader(value) {
  const text = String(value);
  return /^[\x20-\x7E]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text).toString("base64")}?=`;
}

function base64Lines(value) {
  return (
    (Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8"))
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? ""
  );
}

function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}

function safeAttachmentName(value) {
  return (
    basename(String(value))
      .replace(/["\r\n\\]/g, "_")
      .slice(0, 160) || "attachment"
  );
}

function safeLogName(value) {
  return basename(String(value))
    .replace(/[\r\n]/g, " ")
    .slice(0, 120);
}

function publicError(error) {
  if (error instanceof SmtpError) return error.message;
  const code = error?.code;
  if (code === "ENOTFOUND") return "The SMTP host could not be found.";
  if (code === "ECONNREFUSED")
    return "The SMTP server refused the connection. Check the host, port, and security mode.";
  if (code === "ETIMEDOUT") return "The SMTP connection timed out.";
  if (code === "ECONNRESET") return "The SMTP server reset the connection.";
  if (error instanceof Error) return error.message.replace(/[\r\n]+/g, " ").slice(0, 260);
  return "The SMTP campaign failed.";
}

function reportCsv(rows) {
  const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    `email,status,response,error`,
    ...rows.map((row) => [row.email, row.status, row.response, row.error].map(escapeCsv).join(",")),
  ].join("\n");
}

let rawRequest = "";
for await (const chunk of process.stdin) rawRequest += chunk;
await execute(rawRequest);
