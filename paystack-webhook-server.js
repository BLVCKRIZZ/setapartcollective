require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");
const { createClient } = require("@supabase/supabase-js");

// Set these in your environment:
// PAYSTACK_SECRET_KEY, PAYSTACK_WEBHOOK_SECRET, SENDGRID_API_KEY, RECEIPT_FROM_EMAIL, SENDGRID_TEMPLATE_ID,
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const RECEIPT_FROM_EMAIL = process.env.RECEIPT_FROM_EMAIL || "lebea.delmon@gmail.com";
const SENDGRID_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_ID || "d-11a8b13883384b5d8963df64ce30bf3e";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ixmaazkhrdoxcmizvtvn.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PAYSTACK_SECRET_KEY || !PAYSTACK_WEBHOOK_SECRET) {
  console.warn("Missing Paystack environment variables. Set PAYSTACK_SECRET_KEY and PAYSTACK_WEBHOOK_SECRET.");
}

if (!SENDGRID_API_KEY) {
  console.warn("SendGrid API key is missing. Receipt emails will fail until SENDGRID_API_KEY is set.");
} else {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} else {
  console.warn("Supabase is not fully configured. Set SUPABASE_SERVICE_ROLE_KEY to store orders in your Supabase project.");
}

const app = express();

// Paystack requires the raw body to verify the webhook signature.
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

function verifyPaystackSignature(req) {
  const hash = crypto.createHmac("sha512", PAYSTACK_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("hex");
  const signature = req.headers["x-paystack-signature"];
  return signature === hash;
}

function getOrderItems(data) {
  const metadata = data.metadata || {};

  if (metadata.order_items) {
    try {
      return JSON.parse(metadata.order_items);
    } catch (error) {
      console.warn("Invalid order_items metadata", error);
    }
  }

  const customFields = Array.isArray(metadata.custom_fields) ? metadata.custom_fields : [];
  const orderItemsField = customFields.find((field) => field.variable_name === "order_items" || field.display_name === "Order Items");

  if (orderItemsField?.value) {
    try {
      return JSON.parse(orderItemsField.value);
    } catch (error) {
      console.warn("Invalid order_items custom field", error);
    }
  }

  return [];
}

/*
  SendGrid template variables available for your email design:
    {{customer_email}}, {{reference}}, {{amount}}, {{amount_display}}, {{amountDisplay}},
    {{order_date}}, {{orderDate}}, {{payment_method}}, {{paymentMethod}},
    {{help_email}}, {{helpEmail}}, {{brand_name}}, {{brandName}}, {{items}}

  The webhook sends styling data to SendGrid; the template layout and CSS must be built within SendGrid.
*/
function buildTemplateData(data) {
  const customerEmail = data.customer?.email || "";
  const reference = data.reference || "";
  const amount = ((data.amount || 0) / 100).toFixed(2);
  const orderDate = new Date(data.paid_at || data.transaction_date || Date.now()).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const auth = data.authorization || {};
  const cardBrand = auth.brand || auth.card_type || "";
  const cardLast4 = auth.last4 || "";
  const paymentMethod = cardBrand ? `${cardBrand} ending in ${cardLast4}` : "";
  const items = getOrderItems(data);

  return {
    // SendGrid dynamic template variables
    customer_email: customerEmail,
    customerEmail,
    reference,
    amount,
    amount_display: `ZAR ${amount}`,
    amountDisplay: `ZAR ${amount}`,
    order_date: orderDate,
    orderDate,
    payment_method: paymentMethod,
    paymentMethod,
    help_email: RECEIPT_FROM_EMAIL,
    helpEmail: RECEIPT_FROM_EMAIL,
    brand_name: "Set Apart Collective",
    brandName: "Set Apart Collective",
    items,
  };
}

function buildOrderRecord(data, event) {
  const auth = data.authorization || {};
  const amount = (data.amount || 0) / 100;

  return {
    reference: data.reference || "",
    customer_email: data.customer?.email || "",
    amount,
    currency: data.currency || "ZAR",
    status: "paid",
    payment_method: auth.brand || auth.card_type || data.channel || "",
    card_brand: auth.brand || auth.card_type || "",
    card_last4: auth.last4 || "",
    paid_at: data.paid_at || data.transaction_date || new Date().toISOString(),
    order_items: getOrderItems(data),
    raw_payload: event,
    created_at: new Date().toISOString(),
  };
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/webhook/paystack", async (req, res) => {
  if (!verifyPaystackSignature(req)) {
    return res.status(401).send({ status: "error", message: "Invalid signature" });
  }

  const event = req.body;
  if (event.event !== "charge.success") {
    return res.status(200).send({ status: "ignored" });
  }

  const data = event.data;
  const customerEmail = data.customer?.email || "";
  const templateData = buildTemplateData(data);
  const orderRecord = buildOrderRecord(data, event);

  try {
    if (supabase) {
      const { error } = await supabase.from("orders").insert([orderRecord]);
      if (error) {
        throw error;
      }
    }

    if (SENDGRID_API_KEY) {
      await sgMail.send({
        to: customerEmail,
        from: RECEIPT_FROM_EMAIL,
        templateId: SENDGRID_TEMPLATE_ID,
        dynamic_template_data: templateData,
      });
    }

    return res.status(200).send({ status: "success", reference: data.reference || "" });
  } catch (error) {
    console.error("Webhook processing failed", error);
    return res.status(500).send({ status: "error", message: "Unable to process payment" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Paystack webhook server running on port ${PORT}`);
});
