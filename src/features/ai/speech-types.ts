// The runtime is loaded only on demand. Keep this narrow interface aligned with
// whisper.rn 0.7.4's TranscribeFileOptions and TranscribeResult declarations.
export type SpeechContext = {
  transcribe(
    uri: string,
    options: {
      language?: string;
      translate?: boolean;
      maxThreads?: number;
      nProcessors?: number;
      maxContext?: number;
      temperature?: number;
      temperatureInc?: number;
      onProgress?: (value: number) => void;
    },
  ): {
    stop(): Promise<void>;
    promise: Promise<{
      result: string;
      language: string;
      isAborted: boolean;
      segments: { text: string; t0: number; t1: number }[];
    }>;
  };
  release(): Promise<void>;
};
export type SpeechRuntime = {
  initWhisper(options: {
    filePath: string;
    useGpu?: boolean;
    useCoreMLIos?: boolean;
  }): Promise<SpeechContext>;
};
