import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Gemini client (Lazy initialization safe)
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'EarthSignal Server',
      timestamp: new Date().toISOString(),
    });
  });

  // 2. AI Explanation / Hypothesis Verification endpoint using Gemini API
  app.post('/api/ai/explain-anomaly', async (req, res) => {
    try {
      const { cellName, score, contributors, confounders } = req.body;
      
      // If Gemini API Key is available, generate an objective scientific commentary
      if (process.env.GEMINI_API_KEY) {
        const ai = getGeminiClient();
        const prompt = `あなたは地震学・気象学・生物音響学の研究コミュニケーション専門家です。
以下の観測データから、平常時からの統計的乖離に関する学術的かつ客観的な解説文を日本語で150文字以内で作成してください。

【厳格なルール】
1. 「地震が起きる」「予知」「危険」「避難」という断定的な語は絶対に使用禁止。
2. 平常時ベースラインとの統計的な珍しさ（Zスコア）および気象や生活音などの交絡要因（Confounders）を説明すること。
3. 末尾に「※本スコアは平常時データとの差異を示すもので、地震発生確率ではありません。」を明記すること。

【データ】
地域: ${cellName}
観測異常度: ${score} / 100
主な寄与要因: ${JSON.stringify(contributors || [])}
考慮された交絡要因: ${JSON.stringify(confounders || [])}
`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
        });

        return res.json({
          explanation: response.text?.trim() || '平常時ベースラインとの統計的乖離を計算しています。',
          source: 'gemini-3.7-flash',
        });
      } else {
        // Fallback rule-based explanation
        return res.json({
          explanation: `地域（${cellName}）において過去30日同時間帯データと比較した観測異常度は ${score} / 100 です。交絡要因（${confounders?.join(', ') || 'なし'}）を補正の上で集計しています。※本スコアは地震発生確率ではありません。`,
          source: 'rule-based-engine',
        });
      }
    } catch (err: any) {
      console.error('Error generating AI explanation:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Vite middleware for development vs Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EarthSignal server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EarthSignal server:', err);
});
