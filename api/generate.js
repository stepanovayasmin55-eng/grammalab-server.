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
    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

    if (!apiKey) {
      return res.status(500).json({ error: 'В Vercel не найден GEMINI_API_KEY!' });
    }

    const systemPrompt = `Ты — эксперт по русскому языку. Сгенерируй 10 практических вопросов по теме: "${prompt || 'Русский язык'}".

ПРАВИЛА:
1. Ровно 10 вопросов.
2. Для каждого вопроса СТРОГО 3 варианта ответа в массиве options (1 верный, 2 неверных).
3. Поле answer — это индекс верного ответа (0, 1 или 2).
4. Варианты ответов короткие.

Верни ТОЛЬКО валидный JSON-массив без markdown-разметки:
[
  {
    "question": "Текст вопроса?",
    "options": ["Вариант 1", "Вариант 2", "Вариант 3"],
    "answer": 0
  }
]`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: `Ошибка Gemini: ${data.error?.message}` });
    }

    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    const firstBracket = rawText.indexOf('[');
    const lastBracket = rawText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      rawText = rawText.substring(firstBracket, lastBracket + 1);
    }

    return res.status(200).json({ result: rawText });
  } catch (error) {
    return res.status(500).json({ error: `Ошибка генерации: ${error.message}` });
  }
};
