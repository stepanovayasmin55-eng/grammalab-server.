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

ВЫВЕДИ ТОЛЬКО МАССИВ JSON БЕЗ МАРКДАУНА И ТЕКСТА:
[
  {
    "question": "Текст вопроса без кавычек",
    "options": ["Вариант 1", "Вариант 2", "Вариант 3"],
    "answer": 0
  }
]

ПРАВИЛА:
1. Ровно 3 вопроса.
2. В текстах вопросов и ответов НЕ используй кавычки.
3. Каждое значение пиши строго в одну строку.`;

    // Запрос к модели gemini-3.6-flash
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
            maxOutputTokens: 600,
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

    // Чистим текст от блоков кода ```json ... ```
    rawText = rawText.trim();
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    }

    // Достаем строго JSON-массив от '[' до ']'
    const startIdx = rawText.indexOf('[');
    const endIdx = rawText.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1) {
      rawText = rawText.substring(startIdx, endIdx + 1);
    }

    let questionsArray;
    try {
      questionsArray = JSON.parse(rawText);
    } catch (e) {
      // Запасной план: удаляем случайные переносы строк, которые могли сломать JSON
      const sanitized = rawText.replace(/[\r\n]+/g, ' ');
      questionsArray = JSON.parse(sanitized);
    }

    return res.status(200).json(questionsArray);

  } catch (error) {
    return res.status(500).json({ error: `Ошибка генерации: ${error.message}` });
  }
};
