import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Convert File -> Buffer -> Temp File
    const buffer = Buffer.from(await file.arrayBuffer());
    const tempPath = path.join('/tmp', file.name);
    await fs.promises.writeFile(tempPath, buffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
    });

    return NextResponse.json({ text: transcription.text });
  } catch (err: any) {
    console.error('Transcription error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
