module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    const systemPrompt = `Ты — учитель русского языка. Сгенерируй ровно 10 умных, практических вопросов по теме: "${prompt || 'Орфография'}".

Правила:
1. Делай вопросы интересными и логическими (найти ошибку, вставить пропущенную букву, выбрать правильное написание).
2. Для каждого вопроса должно быть СТРОГО 3 варианта ответа (1 верный, 2 неверных).
3. Варианты ответов должны быть короткими.

Отвечай СТРОГО в формате чистого JSON-массива без лишнего текста, без кавычек markdown (```json):
[
  {
    "question": "Текст вопроса?",
    "options": ["Вариант 1", "Вариант 2", "Вариант 3"],
    "answer": 0
  }
]`;

    const response = await fetch(
      '[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [
            {
              role: 'user',
              content: systemPrompt,
            },
          ],
          temperature: 0.5,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Ошибка API Groq');
    }

    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ result: text });
  } catch (error) {
    console.error('Ошибка API:', error);
    return res.status(500).json({
      error: 'Ошибка при генерации заданий',
      details: error.message,
    });
  }
};
