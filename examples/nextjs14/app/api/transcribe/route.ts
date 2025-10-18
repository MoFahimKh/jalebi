import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'edge'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const lang = (formData.get('lang') as string | null)?.toLowerCase()

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Send the uploaded File/Blob directly to OpenAI to avoid disk I/O latency
    const transcription = await openai.audio.transcriptions.create({
      file,
      // Consider swapping to 'gpt-4o-mini-transcribe' for lower latency if available
      model: 'whisper-1',
      ...(lang === 'en' || lang === 'hi' ? { language: lang } : {}),
    })

    return NextResponse.json({ text: transcription.text })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Transcription error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
