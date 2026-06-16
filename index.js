// Файл: index.js
// Главный файл бота. Не пугайся, разберём по кусочкам.
// Бот ежедневно публикует посты в @go_rehab и @Helpforaddicts по программе.
// Расписание (МСК):
//   Пн / Ср / Пт 10:00 — глубокий пост по теме шага
//   Вт / Чт      10:00 — пост-практика
//   Сб           18:00 — диагностический пост-воронка в @ya_lichnost_bot
//   Вс — выходной (без постов)

const https = require('https');
const cron = require('node-cron');

const { STEPS, getCurrentStep, randomFrom } = require('./steps.js');
const { deepPostPrompt, practicePostPrompt, diagnosticPostPrompt } = require('./prompts.js');

// ─────────── НАСТРОЙКИ (берутся из переменных окружения Railway) ───────────
const TG_TOKEN       = process.env.TG_TOKEN;        // токен от @BotFather
const ANTHROPIC_KEY  = process.env.ANTHROPIC_KEY;   // ключ от console.anthropic.com
const CHANNELS       = ['@go_rehab', '@Helpforaddicts'];
const START_DATE     = process.env.START_DATE || '2026-05-12'; // дата старта программы
const TIMEZONE       = 'Europe/Moscow';

// Проверки на запуске — если что-то не так, бот сразу скажет
if (!TG_TOKEN)      { console.error('❌ TG_TOKEN не задан в переменных окружения');      process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('❌ ANTHROPIC_KEY не задан в переменных окружения'); process.exit(1); }

// ─────────── ХЕЛПЕРЫ: запросы к API ───────────

// Универсальный POST-запрос (для Telegram и Anthropic)
function apiRequest(hostname, path, data, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...extraHeaders
      }
    };
    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)); }
        catch (e) { resolve({ raw: chunks, error: e.message }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Запрос к Claude (Anthropic API)
async function callClaude(prompt) {
  const result = await apiRequest(
    'api.anthropic.com',
    '/v1/messages',
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    }
  );

  if (!result.content) {
    throw new Error('Claude API ошибка: ' + JSON.stringify(result));
  }
  return result.content.map(c => c.text || '').join('').trim();
}

// Отправка сообщения в Telegram-канал
async function sendToChannel(channelId, text) {
  return apiRequest(
    'api.telegram.org',
    `/bot${TG_TOKEN}/sendMessage`,
    {
      chat_id: channelId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    }
  );
}

// Публикация поста во все каналы из списка
async function publishToAll(text) {
  for (const channel of CHANNELS) {
    try {
      const result = await sendToChannel(channel, text);
      if (result.ok) {
        console.log(`✅ Опубликовано в ${channel}`);
      } else {
        console.error(`❌ Ошибка публикации в ${channel}:`, result.description);
      }
    } catch (e) {
      console.error(`❌ Исключение при публикации в ${channel}:`, e.message);
    }
  }
}

// ─────────── ТРИ ТИПА ПОСТОВ ───────────

// 1. Глубокий пост (Пн/Ср/Пт)
async function publishDeepPost() {
  console.log('▶ Готовлю глубокий пост...');
  const { step, weekInStep } = getCurrentStep(START_DATE);
  const topic = randomFrom(step.topics);

  console.log(`Шаг ${step.number} (${step.name}), неделя ${weekInStep}, тема: ${topic.idea}`);

  try {
    const prompt = deepPostPrompt(step, weekInStep, topic);
    const post = await callClaude(prompt);
    console.log('Пост готов, первые 80 символов:', post.substring(0, 80) + '...');
    await publishToAll(post);
  } catch (e) {
    console.error('❌ Ошибка генерации глубокого поста:', e.message);
  }
}

// 2. Пост-практика (Вт/Чт)
async function publishPracticePost() {
  console.log('▶ Готовлю пост-практику...');
  const { step } = getCurrentStep(START_DATE);
  const practice = randomFrom(step.practices);

  console.log(`Шаг ${step.number} (${step.name}), практика: ${practice.title}`);

  try {
    const prompt = practicePostPrompt(step, practice);
    const post = await callClaude(prompt);
    console.log('Пост готов, первые 80 символов:', post.substring(0, 80) + '...');
    await publishToAll(post);
  } catch (e) {
    console.error('❌ Ошибка генерации поста-практики:', e.message);
  }
}

// 3. Диагностический пост-воронка (Сб)
async function publishDiagnosticPost() {
  console.log('▶ Готовлю диагностический пост-воронку...');
  const { step } = getCurrentStep(START_DATE);

  try {
    const prompt = diagnosticPostPrompt(step);
    const post = await callClaude(prompt);
    console.log('Пост готов, первые 80 символов:', post.substring(0, 80) + '...');
    await publishToAll(post);
  } catch (e) {
    console.error('❌ Ошибка генерации диагностического поста:', e.message);
  }
}

// ─────────── РАСПИСАНИЕ ───────────
// Формат cron: "минута час день_месяца месяц день_недели"
// День недели: 0 = Вс, 1 = Пн, ..., 6 = Сб

console.log('🤖 Бот "Программа восстановления" запущен');
console.log(`📅 Дата старта программы: ${START_DATE}`);
console.log(`🌍 Часовой пояс: ${TIMEZONE}`);
console.log(`📡 Каналы: ${CHANNELS.join(', ')}`);

const { step, weekInStep, weeksPassed } = getCurrentStep(START_DATE);
console.log(`📍 Сейчас: Шаг ${step.number} (${step.name}), неделя ${weekInStep}/4 этого шага. Всего недель прошло: ${weeksPassed}`);

// Пн / Ср / Пт в 10:00 МСК — глубокий пост
cron.schedule('0 10 * * 1,3,5', publishDeepPost, { timezone: TIMEZONE });

// Вт / Чт в 10:00 МСК — пост-практика
cron.schedule('0 10 * * 2,4', publishPracticePost, { timezone: TIMEZONE });

// Сб в 18:00 МСК — диагностический пост-воронка
cron.schedule('0 18 * * 6', publishDiagnosticPost, { timezone: TIMEZONE });

console.log('🕐 Расписание установлено. Жду время публикаций...');

// ─────────── ТЕСТОВЫЙ ЗАПУСК ───────────
// Если запустишь так: node index.js --test-deep — сразу опубликует глубокий пост
// Это нужно чтобы проверить что бот работает, не дожидаясь утра понедельника.
if (process.argv.includes('--test-deep'))      publishDeepPost();
if (process.argv.includes('--test-practice'))  publishPracticePost();
if (process.argv.includes('--test-diagnostic')) publishDiagnosticPost();
