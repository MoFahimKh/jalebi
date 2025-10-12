'use client';
import { recordAudio } from '@/utils/recorder';
import { useState } from 'react';

type Intent = {
  source_token: string | null;
  target_token: string | null;
  amount: number | null;
  chain: string | null;
};

export default function VoiceAssistant() {
  const [status, setStatus] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [intent, setIntent] = useState<Intent>({
    source_token: null,
    target_token: null,
    amount: null,
    chain: null,
  });

  const speak = (text: string, lang: string = 'en-IN') => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    speechSynthesis.speak(utter);
  };

  const allFilled = (i: Intent) =>
    i.source_token && i.target_token && i.amount && i.chain;

  const askNext = (i: Intent) => {
    if (!i.source_token) return 'Which token do you want to swap from?';
    if (!i.target_token) return 'Which token do you want to receive?';
    if (!i.amount) return 'How much do you want to swap?';
    if (!i.chain) return 'On which chain should I do this swap?';
    return '';
  };

  const handleRecord = async () => {
    setStatus('listening');
    const recorder = await recordAudio();
    recorder.start();

    setTimeout(async () => {
      const audioBlob = await recorder.stop();

      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      // 1. Whisper transcription
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      const { text } = await res.json();
      setTranscript(text);

      // 2. GPT intent extraction
      const intentRes = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const { intent: intentStr } = await intentRes.json();
      const newIntent: Intent = JSON.parse(intentStr);

      // 3. Merge into global intent
      const merged = {
        ...intent,
        ...Object.fromEntries(
          Object.entries(newIntent).map(([k, v]) => [
            k,
            v ?? intent[k as keyof Intent],
          ]),
        ),
      };
      setIntent(merged);

      // 4. Decide next step
      if (allFilled(merged)) {
        speak(
          `Confirm: swap ${merged.amount} ${merged.source_token} to ${merged.target_token} on ${merged.chain}.`,
        );
      } else {
        speak(askNext(merged));
      }

      setStatus('idle');
    }, 5000);
  };

  return (
    <div className="p-6 text-black space-y-4">
      <button
        onClick={handleRecord}
        className="px-4 py-2 bg-blue-600 rounded-lg"
        disabled={status === 'listening'}
      >
        {status === 'listening' ? 'Listening...' : 'Speak'}
      </button>

      {transcript && (
        <p className="text-sm text-gray-300">You said: {transcript}</p>
      )}

      <pre className="bg-black/40 p-4 rounded-lg text-green-300 text-sm">
        {JSON.stringify(intent, null, 2)}
      </pre>
    </div>
  );
}
