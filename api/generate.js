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
    const groqKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;

    if (!groqKey) {
      return res.status(500).json({ error: 'В Vercel не найдена переменная GROQ_API_KEY!' });
    }

    const systemPrompt = `Ты — эксперт по русскому языку. Сгенерируй 3 коротких теста по теме: "${prompt || 'Орфография'}".

Выведи ответ СТРОГО в формате JSON с ключом "questions":
{
  "questions": [
    {
      "question": "Текст вопроса без кавычек",
      "options": ["Вариант1", "Вариант2", "Вариант3"],
      "answer": 0
    }
  ]
}

Правила:
1. Ровно 3 вопроса.
2. В текстах вопросов и ответов не используй кавычки.
3. Поле answer — это индекс правильного ответа (0, 1 или 2).`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'gemma2-9b-it',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Тема: ${prompt || 'Орфография'}` }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      return res.status(500).json({ 
        error: `Ошибка Groq API: ${responseText}` 
      });
    }

    const data = JSON.parse(responseText);
    const rawText = data.choices?.[0]?.message?.content;

    if (!rawText) {
      return res.status(500).json({ error: 'ИИ вернул пустой ответ.' });
    }

    const parsedData = JSON.parse(rawText);
    const questionsArray = parsedData.questions || parsedData.items || (Array.isArray(parsedData) ? parsedData : Object.values(parsedData)[0]);

    return res.status(200).json(questionsArray);

  } catch (error) {
    return res.status(500).json({ error: `Ошибка генерации: ${error.message}` });
  }
};
