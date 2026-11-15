import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioStatus,
  type RecordingOptions,
} from "expo-audio";
import { Platform } from "react-native";

// Keep voice-note lifecycle handling shared by all case and animal screens.
// These objects own native resources and must be unloaded by their callers.
export namespace Audio {
  export const RecordingOptionsPresets = RecordingPresets;
  export const requestPermissionsAsync = requestRecordingPermissionsAsync;

  export class Sound {
    private player: ReturnType<typeof createAudioPlayer>;
    private subscription?: { remove(): void };
    private released = false;
    private finished = false;

    private constructor(source: { uri: string }) {
      this.player = createAudioPlayer(source);
      this.subscription = this.player.addListener(
        "playbackStatusUpdate",
        (status) => {
          if (status.didJustFinish) this.finished = true;
          this.onStatus?.(status);
        },
      );
    }

    private onStatus?: (status: AudioStatus) => void;

    static async createAsync(
      source: { uri: string },
      options: { shouldPlay?: boolean } = {},
    ) {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      const sound = new Sound(source);
      try {
        if (options.shouldPlay) await sound.playAsync();
        return { sound };
      } catch (error) {
        await sound.unloadAsync();
        throw error;
      }
    }

    setOnPlaybackStatusUpdate(callback: (status: AudioStatus) => void) {
      this.onStatus = callback;
    }

    async playAsync() {
      if (this.released) return;
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      if (this.released) return;
      // expo-audio keeps the position at the end after completion.
      if (this.finished) {
        await this.player.seekTo(0);
        this.finished = false;
      }
      if (!this.released) this.player.play();
    }

    async pauseAsync() {
      if (!this.released) this.player.pause();
    }

    async stopAsync() {
      if (this.released) return;
      this.player.pause();
      await this.player.seekTo(0);
      this.finished = false;
    }

    async unloadAsync() {
      if (this.released) return;
      this.released = true;
      this.subscription?.remove();
      this.onStatus = undefined;
      this.player.release();
    }
  }

  export class Recording {
    private recorder: InstanceType<typeof AudioModule.AudioRecorder>;
    private uri: string | null = null;
    private released = false;
    private stopping?: Promise<void>;

    private constructor(options: RecordingOptions) {
      const platformOptions =
        Platform.OS === "ios"
          ? options.ios
          : Platform.OS === "android"
            ? options.android
            : options.web;
      const Recorder =
        (
          AudioModule as typeof AudioModule & {
            AudioRecorderWeb?: typeof AudioModule.AudioRecorder;
          }
        ).AudioRecorderWeb ?? AudioModule.AudioRecorder;
      this.recorder = new Recorder({
        ...options,
        ...platformOptions,
        isMeteringEnabled: options.isMeteringEnabled ?? false,
      });
    }

    static async createAsync(options: RecordingOptions) {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      let recording: Recording | undefined;
      try {
        recording = new Recording(options);
        await recording.recorder.prepareToRecordAsync(options);
        recording.recorder.record();
        return { recording };
      } catch (error) {
        recording?.recorder.release();
        await setAudioModeAsync({ allowsRecording: false });
        throw error;
      }
    }

    async getStatusAsync() {
      return this.released
        ? { isRecording: false, canRecord: false }
        : this.recorder.getStatus();
    }

    stopAndUnloadAsync(): Promise<void> {
      if (this.stopping) return this.stopping;
      if (this.released) return Promise.resolve();
      this.stopping = (async () => {
        try {
          await this.recorder.stop();
          this.uri = this.recorder.uri;
        } finally {
          this.released = true;
          this.recorder.release();
          await setAudioModeAsync({ allowsRecording: false });
        }
      })();
      return this.stopping;
    }

    getURI() {
      return this.uri;
    }
  }
}
