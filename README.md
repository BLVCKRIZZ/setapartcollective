# Set Apart Collective Payment + Receipt Setup

This project adds Paystack checkout support, a backend email receipt flow, and Supabase order storage.

## What is included

- `jsscript.js` collects customer email and passes order metadata to Paystack.
- `paystack-webhook-server.js` listens for Paystack `charge.success` events, stores the payment in Supabase, and sends a receipt email.
- `package.json` defines the backend server dependencies.
- `supabase-schema.sql` creates the database table used by the webhook.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create the Supabase table using the SQL in `supabase-schema.sql`.

3. Set environment variables:

```bash
export PAYSTACK_SECRET_KEY=your_paystack_secret_key
export PAYSTACK_WEBHOOK_SECRET=your_paystack_webhook_secret
export SENDGRID_API_KEY=your_sendgrid_api_key
export RECEIPT_FROM_EMAIL=hello@yourdomain.com
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

On Windows PowerShell:

```powershell
$env:PAYSTACK_SECRET_KEY="your_paystack_secret_key"
$env:PAYSTACK_WEBHOOK_SECRET="your_paystack_webhook_secret"
$env:SENDGRID_API_KEY="your_sendgrid_api_key"
$env:RECEIPT_FROM_EMAIL="hello@yourdomain.com"
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
```

4. Start the webhook server:

```bash
npm start
```

5. Configure Paystack webhook URL:

Set the webhook URL to:

```
https://YOUR_DOMAIN_OR_TUNNEL/webhook/paystack
```

6. Update your Paystack public key in `jsscript.js`:

```js
const paystackPublicKey = "pk_test_your_public_key";
```

## How it works

- The frontend collects customer email before opening Paystack.
- The order total and cart items are saved in Paystack metadata.
- When Paystack confirms payment, it calls the webhook server.
- The webhook verifies the request, stores the order in Supabase, and sends a receipt via SendGrid.

## Notes

- Make sure your sending domain is verified in SendGrid.
- Configure SPF/DKIM for best deliverability.
- Do not use free email addresses like Gmail as the sender.
