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

    const systemPrompt = `Ты — эксперт по русскому языку. Сгенерируй 3 коротких вопроса по теме: "${prompt || 'Орфография'}".

СТРОГИЕ ПРАВИЛА:
1. Выведи ТОЛЬКО массив JSON. Никакого текста, пояснений или скобок до и после JSON.
2. Не используй кавычки (" ") и скобки () внутри самих вопросов и ответов.
3. Формат каждого объекта:
   {"question": "Текст", "options": ["Вариант1", "Вариант2", "Вариант3"], "answer": 0}`;

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
            maxOutputTokens: 500,
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

    // МАСКА ОЧИСТКИ: находим строго границы JSON-массива от первой '[' до последней ']'
    const startIdx = rawText.indexOf('[');
    const endIdx = rawText.lastIndexOf(']');

    if (startIdx === -1 || endIdx === -1) {
      return res.status(500).json({ error: 'ИИ вернул ответ в некорректном формате.' });
    }

    // Вырезаем только JSON и убираем лишние символы
    const jsonString = rawText.substring(startIdx, endIdx + 1).trim();

    const questionsArray = JSON.parse(jsonString);
    return res.status(200).json(questionsArray);

  } catch (error) {
    return res.status(500).json({ error: `Ошибка генерации: ${error.message}` });
  }
};
