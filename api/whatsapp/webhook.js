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

  // 1. GET: Meta Webhook Verification
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'lead_capture_secure_verify_token';

    if (mode && token) {
      if (mode === 'subscribe' && token === verifyToken) {
        console.log('[Meta Webhook] Verified successfully!');
        return res.status(200).send(challenge);
      }
      return res.status(403).json({ error: 'Verification failed' });
    }
    return res.status(200).json({ status: 'WhatsApp webhook active' });
  }

  // 2. POST: Incoming WhatsApp Webhook (Meta Cloud API & n8n Forwarder)
  if (req.method === 'POST') {
    try {
      if (!supabaseUrl || !supabaseKey) {
        console.error('[WhatsApp Webhook] Supabase environment variables missing');
        return res.status(500).json({ error: 'Supabase configuration missing' });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      let rawBody = req.body || {};
      if (typeof rawBody === 'string') {
        try {
          rawBody = JSON.parse(rawBody);
        } catch (pErr) {
          console.warn('[WhatsApp Webhook] Could not parse body string:', pErr.message);
        }
      }

      const root = Array.isArray(rawBody) ? rawBody[0] : rawBody;

      // Drill into value object: root.entry[0].changes[0].value OR root.value OR root
      let value = null;
      if (root.entry && Array.isArray(root.entry) && root.entry[0]?.changes?.[0]?.value) {
        value = root.entry[0].changes[0].value;
      } else if (root.value) {
        value = root.value;
      } else {
        value = root;
      }

      if (!value) {
        return res.status(200).json({ success: true, message: 'NO_VALUE_OBJECT' });
      }

      // Handle message status updates (delivered, read, sent)
      if (value.statuses && Array.isArray(value.statuses) && value.statuses.length > 0) {
        for (const statusObj of value.statuses) {
          try {
            await supabase
              .from('whatsapp_messages')
              .update({ status: statusObj.status })
              .eq('wa_message_id', statusObj.id);
          } catch (stErr) {
            console.warn('[WhatsApp Webhook] Status update failed:', stErr.message);
          }
        }
      }

      // Handle incoming messages
      const messages = value.messages || root.messages;
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(200).json({ success: true, message: 'NO_MESSAGES_PROCESSED' });
      }

      for (const msg of messages) {
        const senderPhone = String(msg.from || value.from || root.from || '').trim();
        const waMessageId = String(msg.id || msg.wamid || root.wamid || `wamid_${Date.now()}`);
        const rawTimestamp = msg.timestamp || root.timestamp;
        const senderName = value.contacts?.[0]?.profile?.name || root.contacts?.[0]?.profile?.name || 'WhatsApp User';

        let messageText = '';
        if (msg.text?.body) {
          messageText = msg.text.body;
        } else if (msg.type === 'text' && typeof msg.text === 'string') {
          messageText = msg.text;
        } else if (msg.interactive) {
          messageText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Interactive Reply]';
        } else if (msg.button) {
          messageText = msg.button?.text || '[Button Click]';
        } else if (typeof msg.body === 'string') {
          messageText = msg.body;
        } else {
          messageText = msg.text?.body || `[${msg.type || 'Media'} Message]`;
        }

        let cleanDigits = senderPhone.replace(/\D/g, '');
        if (cleanDigits.length > 10) {
          cleanDigits = cleanDigits.slice(-10);
        }

        let leadId = null;

        // 1. Search for lead using Supabase RPC `find_lead_by_whatsapp` or direct query
        if (cleanDigits) {
          try {
            const { data: rpcData } = await supabase.rpc('find_lead_by_whatsapp', { p_phone: senderPhone });
            if (rpcData && rpcData.length > 0 && rpcData[0].lead_id) {
              leadId = rpcData[0].lead_id;
            }
          } catch (rpcErr) {
            console.warn('[WhatsApp Webhook] RPC search failed, trying fallback:', rpcErr.message);
          }

          if (!leadId) {
            try {
              const { data: leadMatch } = await supabase
                .from('leads')
                .select('id')
                .or(`phone.ilike.%${cleanDigits}%,whatsapp.ilike.%${cleanDigits}%`)
                .limit(1);
              if (leadMatch && leadMatch.length > 0) {
                leadId = leadMatch[0].id;
              }
            } catch (lErr) {
              console.warn('[WhatsApp Webhook] Direct lead lookup failed:', lErr.message);
            }
          }
        }

        // 2. If Lead does NOT exist, create new lead automatically
        if (!leadId) {
          const formattedPhone = cleanDigits ? `+${senderPhone.replace(/\D/g, '')}` : senderPhone;
          try {
            const { data: newLead, error: newLeadErr } = await supabase
              .from('leads')
              .insert({
                name: senderName || 'WhatsApp Lead',
                phone: formattedPhone,
                whatsapp: formattedPhone,
                source: 'whatsapp',
                status: 'new',
                raw_data: rawBody
              })
              .select('id')
              .single();

            if (!newLeadErr && newLead?.id) {
              leadId = newLead.id;
            }
          } catch (createErr) {
            console.error('[WhatsApp Webhook] Failed to create lead:', createErr.message);
          }
        }

        // 3. Insert message into `whatsapp_messages` table
        const parsedTs = rawTimestamp
          ? new Date(typeof rawTimestamp === 'number' ? rawTimestamp * 1000 : parseInt(rawTimestamp, 10) * 1000)
          : new Date();
        const validTime = isNaN(parsedTs.getTime()) ? new Date() : parsedTs;

        if (leadId) {
          try {
            await supabase.from('whatsapp_messages').insert({
              lead_id: leadId,
              phone: senderPhone,
              direction: 'inbound',
              content: messageText,
              wa_message_id: waMessageId,
              status: 'delivered',
              sent_at: validTime.toISOString()
            });
            console.log('[WhatsApp Webhook] Saved inbound message for lead:', leadId);
          } catch (mErr) {
            console.error('[WhatsApp Webhook] Failed to save message:', mErr.message);
          }
        }
      }

      return res.status(200).json({ success: true, processed: messages.length });
    } catch (err) {
      console.error('[WhatsApp Webhook] Fatal Handler Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
