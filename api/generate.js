import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // Настройка CORS для работы с GitHub Pages
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;
    
    // Инициализация Gemini API с ключом из переменных окружения Vercel
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(prompt || 'Сгенерируй тестовый вопрос по русскому языку.');
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ result: text });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: 'Ошибка при генерации заданий', details: error.message });
  }
}
