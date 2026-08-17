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

    // Промпт с жесткими требованиями к качеству и количеству
    const systemInstruction = `Ты — эксперт по русскому языку. Сгенерируй ровно 10 интересных, нетривиальных вопросов по теме пользователя.
    
Требования:
1. Вопросы должны быть увлекательными, а не банальными правилами из учебника (например: найти ошибку в предложении, вставить пропущенную букву, определить орфограмму на практике).
2. Для каждого вопроса должно быть ровно 3 варианта ответа (один правильный, два неверных, но логичных).
3. Варианты ответов должны быть короткими, чтобы вмещаться на экран смартфона.
4. Ответ верни СТРОГО в формате JSON-массива объектов без лишнего текста и разметки:

[
  {
    "question": "Текст вопроса?",
    "options": ["Вариант 1", "Вариант 2", "Вариант 3"],
    "answer": 0
  }
]
(где "answer" — индекс правильного ответа от 0 до 2)`;

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: systemInstruction,
            },
            {
              role: 'user',
              content: prompt || 'Имя существительное, орфограммы и правила',
            },
          ],
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
