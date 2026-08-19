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

    const modelsResponse = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const modelsData = await modelsResponse.json();

    if (!modelsResponse.ok || !modelsData.data || modelsData.data.length === 0) {
      return res.status(500).json({ 
        error: `Проблема с ключом GROQ_API_KEY. Проверь его в console.groq.com.` 
      });
    }

    const activeModel = modelsData.data[0].id;

    const systemPrompt = `Ты — эксперт по русскому языку. Сгенерируй 10 практических вопросов по теме: "${prompt || 'Русский язык'}".

ПРАВИЛА:
1. Ровно 10 вопросов.
2. Для каждого вопроса СТРОГО 3 варианта ответа в массиве options (1 верный, 2 неверных).
3. Поле answer — это индекс верного ответа (0, 1 или 2).
4. Варианты ответов короткие.

Верни ТОЛЬКО валидный JSON-массив без markdown-разметки (без \`\`\`json) и без любого другого текста:
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
        model: activeModel,
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.2
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: `Ошибка генерации: ${data.error?.message}` });
    }

    let rawText = data.choices?.[0]?.message?.content || '';
    
    // Очищаем от markdown
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    const firstBracket = rawText.indexOf('[');
    const lastBracket = rawText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      rawText = rawText.substring(firstBracket, lastBracket + 1);
    }

    // Возвращаем объект в формате { result: "строка JSON" }, как просит фронтенд
    return res.status(200).json({ result: rawText });
  } catch (error) {
    return res.status(500).json({ error: `Ошибка обработки ответа: ${error.message}` });
  }
};
