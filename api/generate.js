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
      return res.status(500).json({ error: 'Ключ API не настроен' });
    }

    const systemPrompt = `Ты — учитель русского языка. Напиши 10 практических заданий по теме "${prompt || 'Русский язык'}".
Правила:
- Вопросы должны быть интересными и на практику (найти ошибку, вставить букву, выбрать правильную форму).
- Ровно 3 варианта ответа к каждому вопросу (1 верный, 2 неверных).
- Формат строго JSON-массив без текста вокруг:
[
  {
    "question": "Вопрос?",
    "options": ["Ответ 1", "Ответ 2", "Ответ 3"],
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
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.2,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'Ошибка Groq API', details: data.error?.message });
    }

    let rawText = data.choices?.[0]?.message?.content || '';
    
    // Чистим текст от возможной разметки markdown
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    return res.status(200).json({ result: rawText });
  } catch (error) {
    return res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
};
