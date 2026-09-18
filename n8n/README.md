# n8n Workflows - Import Guide

11 workflows. Import each via **n8n → Workflows → ⋯ → Import from File** and press **Active** to activate.

## Setup before import

1. Create your Supabase project, then run `supabase/schema.sql` in the **SQL Editor**.
2. On the n8n instance (Settings → Environment / server env vars) set:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (Project Settings → API → service_role key)
   - `N8N_URL` = your public n8n URL (used to call webhook URLs)
   - `OPENAI_API_KEY` (used by the qualifier + optional personalization)

## Workflows

| # | File | Trigger | Purpose |
|---|------|---------|---------|
| 01 | `01_capture_meta_lead_ads.json` | Webhook `POST /webhook/meta-leads` | Meta Lead Ads → `leads` |
| 02 | `02_capture_linkedin_leads.json` | Webhook `POST /webhook/linkedin-leads` | LinkedIn Lead Gen Forms → `leads` |
| 03 | `03_capture_google_forms.json` | Google Forms trigger | New form responses → `leads` (pick the form in the node) |
| 04 | `04_capture_google_sheets.json` | Google Sheets trigger | New sheet rows → `leads` (pick spreadsheet + sheet in the node) |
| 05 | `05_capture_whatsapp.json` | Webhook `POST /webhook/whatsapp-inbound` | WhatsApp DMs → `leads` (point WhatsApp Cloud API webhook here) |
| 06 | `06_capture_calling_agent.json` | Webhook `POST /webhook/calling-agent` | Dialer/calling-agent payloads → `leads` |
| 07 | `07_ai_qualifier.json` | Every 2 min | Picks `status=new` leads → LLM scores 0-100 → saves score → `>= threshold` → qualified + outreach; otherwise → cold |
| 08 | `08_outreach_email.json` | Webhook `POST /webhook/outreach-email` | Personalized email via Gmail → log → schedule follow-up |
| 09 | `09_outreach_whatsapp.json` | Webhook `POST /webhook/outreach-whatsapp` | WhatsApp message → log → schedule follow-up |
| 10 | `10_outreach_ai_call.json` | Webhook `POST /webhook/outreach-ai-call` | Vapi.ai outbound AI call → log → schedule follow-up |
| 11 | `11_followup_cron.json` | Every 15 min | Fires due follow-ups across channels, marks them done, caps at 3 attempts |

## After import (one-time, in the n8n UI)

1. **01 (Meta):** In Meta Developer Console set the app webhook URL to `https://<n8n>/webhook/meta-leads` for the Lead Gen product.
2. **02 (LinkedIn):** In LinkedIn Campagin Manager → Lead Gen Forms settings, set the form webhook URL to `https://<n8n>/webhook/linkedin-leads`.
3. **03 (Google Forms):** Select the Google credential; the node polls connected form responses every 2 min.
4. **04 (Google Sheets):** Select the Google credential, spreadsheet and sheet name in the trigger node.
5. **05 (WhatsApp):** Set the WhatsApp Business Cloud API webhook to `https://<n8n>/webhook/whatsapp-inbound` for the messages webhook (subscribed field: `messages`).
6. **06 (Calling Agent):** Point your dialer/Vapi webhook to `https://<n8n>/webhook/calling-agent` with JSON: `{ name?, email?, phone?, ... }`.
7. **08-10:** Configure credentials for Gmail (gmailOAuth2), WhatsApp (whatsAppApi), and Vapi (`VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID` envs).
8. Recommended: test each workflow by clicking **Execute workflow** in the editor.

## How the flow works end-to-end

```
source triggers webhook
  → lead inserted into Supabase (status = 'new')
  → 07_ai_qualifier picks it up in <= 2 min
  → LLM returns { score, breakdown, reasoning }
  → score >= 70:
        status='qualified'
        calls outreach-email, outreach-whatsapp, outreach-ai-call webhooks
  → score <  70:
        status='cold' (stored, no outreach)
outreach workflows send the message, log it, and schedule follow-ups
11_followup_cron fires due follow-ups (Day 1/2/3/7) up to 3 attempts
after 3 attempts the engine stops chasing the lead
```

## Customization

- **Threshold:** change `QUALIFY_THRESHOLD` env or the value in the `q-router` IF node (default 70).
- **Scoring rubric / AI model:** edit the system prompt and `OPENAI_MODEL` in workflow 07.
- **Follow-up cadence:** edit the `* 24 * 60 * 60 * 1000` multipliers in workflows 08/09/10.
- **Webhook security:** add a secret by toggling **Add Authorization** on the webhook node and sending the header from the qualifier.