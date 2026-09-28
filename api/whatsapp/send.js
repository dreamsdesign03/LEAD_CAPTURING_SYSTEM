import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lead_id, phone, message, template_name, template_params, template_language, languageCode } = req.body || {};

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    // Build Meta Cloud API Payload
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone
    };

    if (template_name) {
      const resolvedLang = template_language || languageCode || 'en_US';
      payload.type = 'template';
      payload.template = {
        name: template_name,
        language: { code: resolvedLang },
        components: (template_params && template_params.length > 0) ? [
          {
            type: 'body',
            parameters: template_params.map((t) => ({ type: 'text', text: String(t) }))
          }
        ] : []
      };
    } else {
      const bodyText = String(message || '').trim();
      if (!bodyText) {
        return res.status(400).json({ error: 'Cannot send empty message' });
      }
      payload.type = 'text';
      payload.text = { preview_url: false, body: bodyText };
    }

    let metaResData = {};
    let waMessageId = null;

    if (!token || !phoneNumberId) {
      console.error('[WhatsApp Send API] WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing in environment variables.');
      return res.status(500).json({
        error: 'WhatsApp API credentials missing. Please add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID to Vercel Environment Variables.'
      });
    }

    // Post to Meta Cloud API
    const metaRes = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    metaResData = await metaRes.json().catch(() => ({}));
    console.log('[WhatsApp Send API] Meta response:', JSON.stringify(metaResData, null, 2));

    if (!metaRes.ok || metaResData.error) {
      const errMsg = metaResData.error?.message || metaResData.error?.error_user_msg || `Meta WhatsApp API error (${metaRes.status})`;
      console.error('[WhatsApp Send API] Meta API Error:', metaResData.error);
      return res.status(metaRes.status >= 400 && metaRes.status < 600 ? metaRes.status : 500).json({
        error: errMsg,
        meta_error: metaResData.error
      });
    }

    waMessageId = metaResData.messages?.[0]?.id || null;

    // Save outbound message in Supabase
    if (supabaseUrl && supabaseKey && lead_id) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('whatsapp_messages').insert({
          lead_id,
          phone,
          direction: 'outbound',
          content: message || template_name,
          template_name: template_name || null,
          wa_message_id: waMessageId,
          status: 'sent',
          sent_at: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('[WhatsApp Send API] Could not log outbound message to Supabase:', dbErr.message);
      }
    }

    return res.status(200).json({ success: true, message_id: waMessageId, data: metaResData });
  } catch (err) {
    console.error('[WhatsApp Send API] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
