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
    const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;

    if (!apiKey) {
      return res.status(500).json({ error: 'В Vercel не найден GROQ_API_KEY!' });
    }

    const systemPrompt = `Ты — эксперт по русскому языку. Сгенерируй ровно 10 умных и практических вопросов по теме: "${prompt || 'Русский язык'}".

Правила:
1. Вопросы на практику (найти ошибку, вставить букву, выбрать верную форму слова).
2. Для каждого вопроса СТРОГО 3 варианта ответа (1 верный, 2 неверных).
3. Варианты ответов должны быть короткими, чтобы влезали на экран телефона.

Верни ответ СТРОГО в формате чистого JSON-массива без разметки markdown (без \`\`\`json) и без вступительных слов:
[
  {
    "question": "Текст вопроса?",
    "options": ["Вариант 1", "Вариант 2", "Вариант 3"],
    "answer": 0
  }
]`;

    // Список доступных моделей на случай переименования на сервере
    const candidateModels = [
      'gemma2-9b-it',
      'llama-3.2-3b-preview',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768'
    ];

    let lastError = null;

    for (const model of candidateModels) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: systemPrompt }],
          temperature: 0.3,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        let rawText = data.choices?.[0]?.message?.content || '';
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        return res.status(200).json({ result: rawText });
      }

      lastError = data.error?.message || JSON.stringify(data);
    }

    return res.status(500).json({ error: `Groq Отклонил: ${lastError}` });
  } catch (error) {
    return res.status(500).json({ error: `Ошибка сервера: ${error.message}` });
  }
};
