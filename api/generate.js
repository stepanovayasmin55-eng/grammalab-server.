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
    const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

    if (!groqKey && !geminiKey) {
      return res.status(500).json({ error: 'В Vercel не найдены ключи API!' });
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

    let rawText = null;
    let lastError = null;

    // 1. Попытка через Gemini API (с режимом чистого JSON и стабильными моделями)
    if (geminiKey) {
      const geminiModels = ['gemini-2.5-flash', 'gemini-2.5-pro'];

      for (const model of geminiModels) {
        try {
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: {
                  response_mime_type: 'application/json'
                }
              }),
            }
          );

          const geminiData = await geminiResponse.json();
          if (geminiResponse.ok && geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
            rawText = geminiData.candidates[0].content.parts[0].text;
            break;
          } else {
            lastError = `Gemini (${model}): ${geminiData.error?.message || 'Ошибка генерации'}`;
          }
        } catch (err) {
          lastError = `Gemini Error: ${err.message}`;
        }
      }
    }

    // 2. Резервная попытка через Groq API
    if (!rawText && groqKey) {
      const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

      for (const model of groqModels) {
        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: model,
              messages: [{ role: 'user', content: systemPrompt }],
              temperature: 0.2
            }),
          });

          const data = await response.json();
          if (response.ok && data.choices?.[0]?.message?.content) {
            rawText = data.choices[0].message.content;
            break;
          } else {
            lastError = `Groq (${model}): ${data.error?.message || 'Ошибка доступа'}`;
          }
        } catch (err) {
          lastError = `Groq Error: ${err.message}`;
        }
      }
    }

    if (!rawText) {
      return res.status(500).json({ error: `Не удалось сгенерировать вопросы: ${lastError}` });
    }

    // Безопасное выделение и парсинг JSON
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBracket = rawText.indexOf('[');
    const lastBracket = rawText.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
      rawText = rawText.substring(firstBracket, lastBracket + 1);
    }

    let questionsArray;
    try {
      questionsArray = JSON.parse(rawText);
    } catch (parseErr) {
      return res.status(500).json({ error: `Неверный формат ответа ИИ. Попробуйте еще раз. (${parseErr.message})` });
    }

    return res.status(200).json(questionsArray);
  } catch (error) {
    return res.status(500).json({ error: `Ошибка обработки ответа: ${error.message}` });
  }
};
