# program-posting-bot

Telegram-бот, публикующий посты по "Программе восстановления личности" Дмитрия Петрова.

## Расписание (МСК)
- **Пн / Ср / Пт, 10:00** — глубокий пост по теме одного из 11 шагов
- **Вт / Чт, 10:00** — пост-практика (чек-лист или техника)
- **Сб, 18:00** — диагностический пост-воронка в @ya_lichnost_bot
- **Вс** — без постов

## Каналы
Постит одновременно в:
- @go_rehab
- @Helpforaddicts

## Стек
- Node.js 18+
- node-cron — для расписания
- Anthropic Claude Sonnet 4 — генерация постов
- Telegram Bot API — публикация
- Деплой: Railway

## Переменные окружения
- `TG_TOKEN` — токен бота от @BotFather
- `ANTHROPIC_KEY` — API-ключ Anthropic (от console.anthropic.com)
- `START_DATE` — дата старта программы в формате YYYY-MM-DD (по умолчанию 2026-05-12)

## Структура файлов
- `index.js` — основной код бота, расписание, публикация
- `prompts.js` — системные промпты для ИИ (правь здесь, если хочешь изменить тон/стиль)
- `steps.js` — данные 11 шагов программы (имя, идея, темы, практики)
- `package.json` — зависимости
- `railway.json` — конфигурация деплоя на Railway

## Тестирование
Локально или на Railway можно вручную запустить пост:
```bash
node index.js --test-deep      # глубокий пост сейчас
node index.js --test-practice  # пост-практика сейчас
node index.js --test-diagnostic # диагностический пост сейчас
```

## Установка локально (для разработки)
```bash
npm install
TG_TOKEN=xxx ANTHROPIC_KEY=yyy node index.js
```
