export function recordAudio() {
  return new Promise<{ start: () => void; stop: () => Promise<Blob> }>(
    async (resolve) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Lower bitrate to reduce upload size and speed up transcription
      const options: MediaRecorderOptions = {}
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus'
      }
      // 64kbps is usually enough for speech
      ;(options as any).audioBitsPerSecond = 64000
      const mediaRecorder = new MediaRecorder(stream, options)
      let chunks: BlobPart[] = []

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data)

      const start = () => {
        chunks = []
        mediaRecorder.start()
      }

      const stop = () =>
        new Promise<Blob>((res) => {
          mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' })
            res(blob)
          }
          mediaRecorder.stop()
        })

      resolve({ start, stop })
    }
  )
}
