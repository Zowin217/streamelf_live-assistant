export const transcribeWithWhisper = async (audioBlob: Blob, language: string = 'en'): Promise<string | null> => {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'chunk.webm');
    formData.append('language', language); // Set language to English for better accuracy

    console.log(`[Transcription] Sending audio: ${audioBlob.size} bytes, type: ${audioBlob.type}, language: ${language}`);

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorDetail;
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail || errorData.error || 'Unknown error';
        console.error('[Transcription] Server error:', errorData);
      } catch {
        errorDetail = await response.text();
        console.error('[Transcription] Server error (text):', errorDetail);
      }
      console.error(`[Transcription] Failed with status ${response.status}:`, errorDetail);
      return null;
    }

    const data = await response.json();
    console.log(`[Transcription] Success: ${data?.text?.substring(0, 50)}...`);
    return data?.text || null;
  } catch (error) {
    console.error('[Transcription] Network/parse error:', error);
    if (error instanceof Error) {
      console.error('[Transcription] Error message:', error.message);
      console.error('[Transcription] Error stack:', error.stack);
    }
    return null;
  }
};

