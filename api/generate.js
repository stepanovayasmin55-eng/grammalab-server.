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
      return res.status(500).json({ error: 'Ключ GROQ_API_KEY не найден в Vercel' });
    }

    const systemPrompt = `Ты — эксперт по русскому языку. Сгенерируй ровно 10 умных, практических вопросов по теме: "${prompt || 'Русский язык'}".

Требования:
1. Вопросы на практику (найти ошибку, выбрать верную букву, правильную форму слова).
2. Для каждого вопроса СТРОГО 3 варианта ответа (1 верный, 2 неверных).
3. Короткие варианты ответов.

Верни ТОЛЬКО массив JSON без какого-либо текста, вступительных слов и разметки markdown:
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
        model: 'llama-3.3-70b-versatile',
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
      throw new Error(data.error?.message || 'Ошибка API Groq');
    }

    let rawText = data.choices?.[0]?.message?.content || '';

    // Очищаем результат от возможной markdown-разметки ```json ... ```
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    return res.status(200).json({ result: rawText });
  } catch (error) {
    console.error('Ошибка сервера:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      details: error.message,
    });
  }
};
