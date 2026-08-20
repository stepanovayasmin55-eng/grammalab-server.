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
    const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

    if (!geminiKey) {
      return res.status(500).json({ error: 'В Vercel не найдена переменная GEMINI_API_KEY!' });
    }

    const systemPrompt = `Ты — эксперт по русскому языку. Сгенерируй 3 коротких вопроса по теме: "${prompt || 'Орфография'}".

ПРАВИЛА:
1. Строго 3 вопроса.
2. В каждом вопросе ровно 3 коротких варианта ответа.
3. Поле answer — это индекс ответа (0, 1 или 2).
4. Пиши весь текст каждого вопроса и варианта strictly в одну строку без переносов строк (newline).
5. Не используй двойные кавычки внутри текста.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 600,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  question: { type: 'STRING' },
                  options: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                  },
                  answer: { type: 'INTEGER' }
                },
                required: ['question', 'options', 'answer']
              }
            }
          }
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ 
        error: `Ошибка Gemini API: ${data.error?.message || 'Неизвестная ошибка'}` 
      });
    }

    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return res.status(500).json({ error: 'ИИ вернул пустой ответ.' });
    }

    // Удаляем возможные неэкранированные переносы строк внутри JSON-строк
    const cleanJson = rawText
      .replace(/[\r\n]+/g, ' ')
      .trim();

    const questionsArray = JSON.parse(cleanJson);
    return res.status(200).json(questionsArray);

  } catch (error) {
    return res.status(500).json({ error: `Ошибка генерации: ${error.message}` });
  }
};
