export function recordAudio() {
  return new Promise<{
    start: () => void;
    stop: () => Promise<Blob>;
  }>(async (resolve) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    let chunks: BlobPart[] = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

    const start = () => {
      chunks = [];
      mediaRecorder.start();
    };

    const stop = () =>
      new Promise<Blob>((res) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          res(blob);
        };
        mediaRecorder.stop();
      });

    resolve({ start, stop });
  });
}
