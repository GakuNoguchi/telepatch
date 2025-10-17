import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple cosine similarity
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

export default async function handler(req, res) {
  // CORS headers
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
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // OpenAI setup
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Load vector store
    const vectorStorePath = path.join(process.cwd(), '.system', 'vector-data', 'vector_store.json');
    if (!fs.existsSync(vectorStorePath)) {
      return res.status(500).json({ error: 'Vector store not found. Please run reindex.' });
    }

    const vectorData = JSON.parse(fs.readFileSync(vectorStorePath, 'utf-8'));

    // Generate query embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search by cosine similarity
    const results = vectorData.map(doc => ({
      ...doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, 3);

    // Format search results as context
    const context = topResults
      .map((result, i) => `[ドキュメント${i + 1}: ${result.metadata.filename}]\n${result.document}`)
      .join('\n\n---\n\n');

    const systemPrompt = `あなたはHumanitieドキュメントのアシスタントです。
以下のドキュメントから取得した情報を元に、ユーザーの質問に答えてください。

ドキュメントの内容：
${context}

回答する際のルール：
- ドキュメントの内容に基づいて正確に回答してください
- ドキュメントに記載がない場合は、「ドキュメントには記載がありません」と伝えてください
- 簡潔で分かりやすい日本語で回答してください
- 必要に応じてドキュメント名を引用してください`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return res.status(500).json({ error: 'Failed to generate response' });
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;

    res.status(200).json({
      answer,
      sources: topResults.map(r => ({
        file: r.metadata.filename,
        score: r.similarity
      }))
    });

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
