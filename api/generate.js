import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { topic } = req.body || {};
    if (!topic) return res.status(400).json({ error: 'Укажите тему' });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Придумай 5 коротких учебных вопросов на тему "${topic}". Ответ верни СТРОГО в формате JSON без разметки: {"questions": [{"q": "Вопрос?", "a": "Верно", "n": "Неверно"}]}`,
        });

        let rawText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(rawText);
        
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
