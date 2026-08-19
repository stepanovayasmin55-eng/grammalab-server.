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
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'В Vercel не найден GROQ_API_KEY!' });
    }

    const systemPrompt = `Ты — эксперт по русскому языку. Сгенерируй ровно 10 умных, интересных и практических вопросов по теме: "${prompt || 'Русский язык'}".

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

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [
          {
            role: 'user',
            content: systemPrompt,
          },
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || JSON.stringify(data);
      return res.status(500).json({ error: `Groq Отклонил: ${errMsg}` });
    }

    let rawText = data.choices?.[0]?.message?.content || '';

    // Очищаем текст от лишних синтаксических мусоров
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    return res.status(200).json({ result: rawText });
  } catch (error) {
    return res.status(500).json({ error: `Ошибка сервера: ${error.message}` });
  }
};
