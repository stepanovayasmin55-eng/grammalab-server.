module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { prompt } = req.body || {};
    const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

    if (!geminiKey) {
      return res.status(500).json({ error: 'В Vercel не найдена переменная GEMINI_API_KEY!' });
    }

    const systemPrompt = `Составь 3 коротких вопроса по русскому языку на тему: "${prompt || 'Орфография'}".
Требования к ответу:
- Выведи результат только в виде чистейшего JSON массива.
- Не используй никакие двойные или одинарные кавычки внутри самих вопросов и ответов (заменяй их при необходимости на ёлочки « »).
- Не добавляй переносы строк внутри текста.
- В каждом объекте строго три поля: question (строка), options (массив из 3 строк), answer (число от 0 до 2).`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 800,
            responseMimeType: 'application/json'
          }
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ 
        error: `Ошибка Gemini API: ${data.error?.message || 'Неизвестная ошибка'}` 
      });
    }

    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return res.status(500).json({ error: 'ИИ вернул пустой ответ.' });
    }

    // Удаляем спецсимволы разметки, табуляторы и переводы строк
    let cleanText = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/[\r\n\t]/g, ' ')
      .trim();

    // Вырезаем strictly то, что внутри квадратных скобок [ ... ]
    const startIdx = cleanText.indexOf('[');
    const endIdx = cleanText.lastIndexOf(']');

    if (startIdx !== -1 && endIdx !== -1) {
      cleanText = cleanText.substring(startIdx, endIdx + 1);
    }

    const questionsArray = JSON.parse(cleanText);
    return res.status(200).json(questionsArray);

  } catch (error) {
    return res.status(500).json({ error: `Ошибка генерации: ${error.message}` });
  }
};
