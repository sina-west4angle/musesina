// musesina-feishu-webhook ── 飞书消息 Webhook（Supabase Edge Function）
// 逻辑依据《飞书智能体避坑指南》：
//  1. 加密 challenge 解密（body.encrypt + MUSESINA_FEISHU_ENCRYPT_KEY）
//  2. sender_type != user 的消息直接丢弃，不回不入库
//  3. 群聊只处理真正 @自己的；私聊全处理
//  4. 指令执行并回执；普通聊天进收件箱表，飞书回"收到，稍后回你"
//
// 环境变量（Supabase Dashboard → Edge Functions → Secrets 配置，绝不进 git）：
//   MUSESINA_FEISHU_APP_ID / MUSESINA_FEISHU_APP_SECRET / MUSESINA_FEISHU_ENCRYPT_KEY
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// 白名单：musesina_db_write 只允许这些表（统一 musesina_ 前缀）
const ALLOWED_TABLES = new Set([
  "musesina_chat_inbox",
  "musesina_feishu_command_log",
  "musesina_memo",
  "musesina_scheduled_task",
  "musesina_url_cache",
]);

// ---------- 加密 challenge 解密 ----------
// 飞书事件订阅的 URL 校验：body.encrypt 是加密后的 challenge，用 encrypt_key 解密，不是明文。
// 注意：WebCrypto AES-CBC 会自动去除 PKCS7 padding，不要手动再 strip，
// 否则 JSON 被截断，飞书报"返回数据不是合法的JSON格式"。
// TODO: 按飞书官方文档确认 encrypt 字段的编码与 IV 取法后再填实。
async function decryptChallenge(encrypt: string, encryptKey: string): Promise<string> {
  void encrypt;
  void encryptKey;
  throw new Error("TODO: 按飞书官方文档实现 challenge 解密");
}

// ---------- 通用数据库写入 ----------
// 有些连接器只发 apikey 头会被当成 anon 用户，写操作被 RLS 拦（42501）。
// 解法：函数内用 service_role key 直写，只允许白名单表。
async function musesina_db_write(table: string, row: Record<string, unknown>) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`表不在白名单: ${table}`);
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`musesina_db_write 失败 ${res.status}: ${await res.text()}`);
}

// ---------- 飞书回复 ----------
// TODO: 用 MUSESINA_FEISHU_APP_ID / MUSESINA_FEISHU_APP_SECRET 换 tenant_access_token
// 后调用消息 API 回复，按飞书官方文档核对 endpoint。
async function replyFeishu(messageId: string, text: string): Promise<void> {
  void messageId;
  void text;
  throw new Error("TODO: 按飞书官方文档实现消息回复");
}

// ---------- 消息分流 ----------
serve(async (req) => {
  const body = await req.json();

  // 1. URL 校验：加密 challenge，直接把解密结果返回
  if (body.encrypt) {
    const challenge = await decryptChallenge(
      body.encrypt,
      Deno.env.get("MUSESINA_FEISHU_ENCRYPT_KEY")!,
    );
    return new Response(JSON.stringify({ challenge }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const event = body.event ?? {};
  const senderType = event.sender?.sender_type;

  // 2. 非 user 消息直接丢弃（聚合群全是机器人消息，不区分会被刷爆）
  if (senderType && senderType !== "user") {
    return new Response("ok");
  }

  const chatType: string = event.message?.chat_type ?? "p2p"; // p2p 私聊 / group 群聊
  const messageId: string = event.message?.message_id;
  const text: string = extractText(event);

  // 3. 群聊只处理真正 @自己的，@别人的不理；私聊全处理
  if (chatType === "group" && !isBotMentioned(event)) {
    return new Response("ok");
  }

  await musesina_db_write("musesina_feishu_command_log", {
    message_id: messageId,
    chat_type: chatType,
    text,
    created_at: new Date().toISOString(),
  });

  // 4. 指令执行回执；普通聊天进收件箱并回"收到，稍后回你"
  if (isCommand(text)) {
    const receipt = await handleCommand(text);
    await replyFeishu(messageId, receipt);
  } else {
    await musesina_db_write("musesina_chat_inbox", {
      message_id: messageId,
      chat_type: chatType,
      text,
      created_at: new Date().toISOString(),
    });
    await replyFeishu(messageId, "收到，稍后回你");
  }

  return new Response("ok");
});

// ---------- 待按飞书消息结构填实 ----------
function extractText(_event: unknown): string {
  throw new Error("TODO: 按飞书事件结构解析文本");
}
function isBotMentioned(_event: unknown): boolean {
  throw new Error("TODO: 按飞书事件结构判断是否 @机器人自己");
}
function isCommand(text: string): boolean {
  return text.startsWith("记");
}
async function handleCommand(_text: string): Promise<string> {
  throw new Error("TODO: 实现指令执行逻辑");
}
