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
    const { lead_id, phone, message, template_name, template_params } = req.body || {};

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
      payload.type = 'template';
      payload.template = {
        name: template_name,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: (template_params || []).map((t) => ({ type: 'text', text: String(t) }))
          }
        ]
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

    // If WhatsApp credentials are set, post to Meta Cloud API
    if (token && phoneNumberId) {
      const metaRes = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      metaResData = await metaRes.json().catch(() => ({}));
      if (!metaRes.ok || metaResData.error) {
        console.error('[WhatsApp Send API] Meta API error:', metaResData);
        throw new Error(metaResData.error?.message || `Meta WhatsApp API error (${metaRes.status})`);
      }
      waMessageId = metaResData.messages?.[0]?.id || null;
    } else {
      console.warn('[WhatsApp Send API] WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set. Mocking send.');
      waMessageId = `mock_wamid_${Date.now()}`;
    }

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
