import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a crypto swap intent extractor.
Extract only what user provided. Use JSON with keys:
{ "source_token": string|null, "target_token": string|null, "amount": number|null, "chain": string|null }.
If something is missing, set it to null.`,
        },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
    });

    const parsed = completion.choices[0].message.content;
    return NextResponse.json({ intent: parsed });
  } catch (err: any) {
    console.error('Intent error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
