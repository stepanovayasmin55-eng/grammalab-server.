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
      return res.status(500).json({ error: 'API key is missing' });
    }

    const systemPrompt = `Ты — эксперт по русскому языку. Сгенерируй ровно 10 умных и практических вопросов по теме: "${prompt || 'Русский язык'}".

Правила:
1. Вопросы должны быть на практику: найти ошибку, вставить пропущенную букву, выбрать правильную форму слова.
2. Для каждого вопроса сделай СТРОГО 3 варианта ответа (1 верный, 2 неверных).
3. Варианты ответов должны быть короткими.

Верни ответ СТРОГО в формате JSON без разметки markdown:
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
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'user',
            content: systemPrompt,
          },
        ],
        temperature: 0.5,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Groq Error');
    }

    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ result: text });
  } catch (error) {
    return res.status(500).json({
      error: ' Ошибка сервера',
      details: error.message,
    });
  }
};
