const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function setup({ failPrepare = false } = {}) {
  const events = [];
  let listener;
  const player = {
    addListener(_, callback) {
      listener = callback;
      return { remove: () => events.push("unsubscribe") };
    },
    play: () => events.push("play"),
    pause: () => events.push("pause"),
    seekTo: async (position) => events.push(["seek", position]),
    release: () => events.push("release-player"),
  };
  class Recorder {
    uri = null;
    constructor(options) {
      assert.equal(options.extension, ".m4a");
      assert.equal(options.outputFormat, "aac");
    }
    async prepareToRecordAsync(options) {
      events.push(["prepare", options]);
      if (failPrepare) throw new Error("microphone unavailable");
    }
    record() {
      events.push("record");
    }
    async stop() {
      this.uri = "file:///voice.m4a";
      events.push("stop");
    }
    release() {
      this.uri = null;
      events.push("release-recorder");
    }
    getStatus() {
      return { isRecording: true, canRecord: true };
    }
  }
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync("src/services/voiceAudio.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === "react-native") return { Platform: { OS: "ios" } };
      assert.equal(name, "expo-audio");
      return {
        AudioModule: { AudioRecorder: Recorder },
        createAudioPlayer: () => player,
        RecordingPresets: {
          HIGH_QUALITY: { extension: ".m4a", ios: { outputFormat: "aac" } },
        },
        requestRecordingPermissionsAsync: async () => ({ granted: true }),
        setAudioModeAsync: async (mode) =>
          events.push(["mode", mode.allowsRecording]),
      };
    },
  });
  return {
    Audio: exports.Audio,
    events,
    finish: () => listener({ isLoaded: true, didJustFinish: true }),
  };
}

test("completed voice notes rewind on replay and release only once", async () => {
  const { Audio, events, finish } = setup();
  const { sound } = await Audio.Sound.createAsync(
    { uri: "file:///voice.m4a" },
    { shouldPlay: true },
  );
  let finished = false;
  sound.setOnPlaybackStatusUpdate((status) => {
    finished = status.didJustFinish;
  });
  finish();
  assert.equal(finished, true);
  await sound.playAsync();
  assert.ok(
    events.some(
      (event) => Array.isArray(event) && event[0] === "seek" && event[1] === 0,
    ),
  );
  await sound.stopAsync();
  await sound.unloadAsync();
  await sound.unloadAsync();
  assert.equal(events.filter((event) => event === "release-player").length, 1);
  assert.ok(events.indexOf("unsubscribe") < events.indexOf("release-player"));
});

test("unloading during playback setup does not use a released player", async () => {
  const { Audio, events } = setup();
  const { sound } = await Audio.Sound.createAsync({ uri: "file:///voice.m4a" });
  const playing = sound.playAsync();
  await sound.unloadAsync();
  await playing;
  assert.equal(events.includes("play"), false);
});

test("concurrent recording cleanup stops once and preserves the upload URI", async () => {
  const { Audio, events } = setup();
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );
  await Promise.all([
    recording.stopAndUnloadAsync(),
    recording.stopAndUnloadAsync(),
  ]);
  await recording.stopAndUnloadAsync();
  assert.equal(recording.getURI(), "file:///voice.m4a");
  assert.equal(events.filter((event) => event === "stop").length, 1);
  assert.equal(
    events.filter((event) => event === "release-recorder").length,
    1,
  );
  assert.equal(events.at(-1)[1], false);
});

test("failed recorder preparation releases the microphone and resets audio mode", async () => {
  const { Audio, events } = setup({ failPrepare: true });
  await assert.rejects(
    Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY),
    /microphone unavailable/,
  );
  assert.ok(events.includes("release-recorder"));
  assert.equal(events.at(-1)[1], false);
});
