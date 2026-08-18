function normalizePhoneNumber(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");

  if (!digits) return "";

  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0092")) return digits.slice(2);
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;

  return digits;
}

async function postWhatsAppMessage(phoneNumberId, accessToken, apiVersion, payload) {
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      ...payload,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || "WhatsApp message failed.");
  }

  return data;
}

export async function sendWhatsAppText({ to, message }) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v20.0";
  const recipient = normalizePhoneNumber(to);
  const body = String(message || "").trim();

  if (!phoneNumberId || !accessToken || !recipient || !body) {
    return { success: false, skipped: true };
  }

  const data = await postWhatsAppMessage(phoneNumberId, accessToken, apiVersion, {
    to: recipient,
    type: "text",
    text: { body },
  });

  return { success: true, data };
}

export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = "en_US",
  components = [],
}) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v20.0";
  const recipient = normalizePhoneNumber(to);
  const name = String(templateName || process.env.WHATSAPP_ADMISSION_FORM_TEMPLATE || "").trim();

  if (!phoneNumberId || !accessToken || !recipient || !name) {
    return { success: false, skipped: true };
  }

  const data = await postWhatsAppMessage(phoneNumberId, accessToken, apiVersion, {
    to: recipient,
    type: "template",
    template: {
      name,
      language: { code: languageCode },
      components,
    },
  });

  return { success: true, data };
}
