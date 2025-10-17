import { vectorSearch } from 'eddie-vector-search';

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

    // ベクトル検索でドキュメントを取得
    const searchResults = await vectorSearch(message, {
      topK: 3,
      docsDir: 'edit/4.publish📚'
    });

    // 検索結果をコンテキストとして整形
    const context = searchResults
      .map((result, i) => `[ドキュメント${i + 1}: ${result.file}]\n${result.content}`)
      .join('\n\n---\n\n');

    // OpenAI APIで回答生成
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

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
      sources: searchResults.map(r => ({
        file: r.file,
        score: r.score
      }))
    });

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
