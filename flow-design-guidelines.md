# Flow Design Guidelines - Voice Input & Media Management

**Purpose:** Standardized patterns for voice input, transcription, and media file management in the Pak Vets app. Applies to **Case**-scoped entities: Diagnoses, Treatments, and Notes (and media attached to a case).

**Last Updated:** February 2026

---

## 🎯 Core Concept

The app is **Case-centric**: each case has diagnoses, treatments, notes, and media. Add screens receive `caseId` via route params (e.g. `/add-diagnosis?caseId=123`). After save, navigation goes to `/case-detail?caseId=...`.

Each section (Diagnoses, Treatments, Notes) supports a unified input flow:
1. **Type** text directly OR **Record** voice using microphone
2. **Transcribe** audio automatically via AssemblyAI
3. **Edit** transcribed text before saving
4. **Store** both text and audio file
5. **Playback** audio later for review

---

## 📋 Standard Flow Pattern

### 1. Voice Input Flow

```
User Action → Record Audio → Upload to S3 → Transcribe → Display Transcript → Edit → Save
```

**Key Components:**
- `VoiceMessageRecorder` component handles recording
- Transcription happens automatically via `shared-services-api`
- Transcript populates text input field
- User can edit transcript before saving

### 2. Media File Creation Flow

```
Record Audio → Upload to S3 → Get S3 Key → Create MediaFile (caseId) → Get mediaId → Link to Entity
```

**Critical Sequence:**
1. Audio recording completes → S3 upload → Get `s3Key`
2. Create `MediaFile` record with `caseId`, `fileType: "AUDIO"`, `s3Key`, and `url`
3. Receive `mediaId` from MediaFile creation
4. Link `mediaId` to entity (CaseDiagnosis, CaseTreatment, or CaseNote)

### 3. Entity Creation Pattern

```typescript
// Standard pattern for creating entities with voice input (Diagnosis, Treatment, Note)
const handleSave = async () => {
  let mediaId: number | undefined = undefined;

  // Step 1: Create MediaFile if voice recording exists
  if (voiceRecording?.s3Key && caseId) {
    const bucketName = getBucketName();
    const s3Url = `https://${bucketName}.s3.amazonaws.com/${voiceRecording.s3Key}`;

    const mediaFile = await createMediaMutation.mutateAsync({
      caseId,
      fileType: "AUDIO",
      s3Key: voiceRecording.s3Key,
      url: s3Url,
    });

    mediaId = mediaFile.mediaId;
  }

  // Step 2: Create entity with mediaId link
  await createEntityMutation.mutateAsync({
    caseId,
    // ... other required fields
    ...(mediaId !== undefined && { mediaId: Number(mediaId) }),
  });
};
```

**Important:**
- Always convert `mediaId` to `Number()` before sending to API
- Use conditional spread `...(mediaId !== undefined && { mediaId })` to only include when defined
- Create MediaFile BEFORE creating the entity
- Add screens receive `caseId` from route params (`/add-diagnosis?caseId=`, etc.)

---

## 🏗️ Component Structure

### Add Screen Pattern (add-diagnosis.tsx, add-treatment.tsx, add-note.tsx)

Add screens get `caseId` from `useLocalSearchParams()` and require it to be valid.

```typescript
const caseId = params.caseId ? Number(params.caseId) : undefined;

// Required State
const [text, setText] = useState("");
const [voiceRecording, setVoiceRecording] = useState<{
  s3Key: string;
  rawText: string;
  improvedText?: string;
  localUri: string;
} | null>(null);
const [sound, setSound] = useState<Audio.Sound | null>(null);
const [isPlaying, setIsPlaying] = useState(false);

// Required Mutations (from features/diagnoses, features/treatments, features/notes, features/media)
const createEntityMutation = useCreateCaseDiagnosis(); // or useCreateCaseTreatment() or useCreateCaseNote()
const createMediaMutation = useCreateMediaFile();

// Required Handlers
const handleVoiceRecordingComplete = useCallback((s3Key, rawText, improvedText?, localUri?) => {
  setVoiceRecording({ s3Key, rawText, improvedText, localUri: localUri || "" });
  setText(improvedText || rawText);
}, []);

const handleTranscriptReady = useCallback((transcript: string) => {
  setText(transcript);
}, []);

const handlePlayPause = useCallback(async () => {
  // Audio playback logic
}, [voiceRecording, sound, isPlaying]);

const handleRecordAgain = useCallback(() => {
  setVoiceRecording(null);
  setText("");
  if (sound) {
    sound.unloadAsync();
    setSound(null);
  }
  setIsPlaying(false);
}, [sound]);
```

### UI Structure Pattern

```tsx
<Card style={styles.inputCard}>
  <View style={styles.inputContainer}>
    {/* Voice Recording Playback (if exists) */}
    {voiceRecording && (
      <View style={styles.voicePlaybackCard}>
        <View style={styles.voicePlaybackHeader}>
          <FontAwesome name="microphone" size={14} color={colors.primary} />
          <Text>Voice recorded</Text>
          <TouchableOpacity onPress={handlePlayPause}>
            <FontAwesome name={isPlaying ? "pause" : "play"} />
          </TouchableOpacity>
          {isPlaying && (
            <TouchableOpacity onPress={handleStop}>
              <FontAwesome name="stop" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleRecordAgain}>
            <FontAwesome name="times" />
          </TouchableOpacity>
        </View>
      </View>
    )}

    {/* Text Input Area */}
    <View style={styles.textInputWrapper}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Type or tap microphone to record..."
        multiline
        textAlignVertical="top"
      />
      {/* Microphone Button - Bottom Right */}
      <View style={styles.micButtonWrapper}>
        <VoiceMessageRecorder
          onTranscriptReady={handleTranscriptReady}
          onRecordingComplete={handleVoiceRecordingComplete}
          onError={(error: Error) => Alert.alert("Error", error.message)}
          buttonSize={32}
          buttonColor={colors.primary}
          caseId={caseId}
        />
      </View>
    </View>
  </View>
</Card>
```

---

## 🎨 UI Design Standards

### ChatGPT-Style Input Pattern

**Visual Design:**
- Unified text input with integrated microphone button
- Microphone button positioned bottom-right of input field
- Voice playback card appears above input when recording exists
- Clean, modern aesthetic with proper spacing

**Styling Constants:**
```typescript
const styles = StyleSheet.create({
  inputCard: {
    marginBottom: 16,
    padding: 0,
    overflow: "hidden",
  },
  inputContainer: {
    padding: 16,
  },
  textInputWrapper: {
    position: "relative",
    minHeight: 120,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 44, // Space for mic button
    fontSize: 16,
    minHeight: 120,
    maxHeight: 300,
  },
  micButtonWrapper: {
    position: "absolute",
    bottom: 8,
    right: 8,
    zIndex: 10,
  },
  voicePlaybackCard: {
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
});
```

---

## 🔄 Audio Playback Pattern (Case Detail Screen)

### Component Structure (case-detail screen)

```typescript
interface EntityItemProps {
  entity: CaseDiagnosis | CaseTreatment | CaseNote;
  audioMedia: MediaFile | null | undefined;
  colors: ReturnType<typeof useTheme>["colors"];
  getAudioUrl: (media: MediaFile) => Promise<string | null>;
}

function EntityItem({ entity, audioMedia, colors, getAudioUrl }: EntityItemProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Load audio URL when component mounts (signed URL from getAudioUrl)
  useEffect(() => {
    if (audioMedia) {
      getAudioUrl(audioMedia).then(setAudioUrl);
    } else {
      setAudioUrl(null);
    }
  }, [entity, audioMedia, getAudioUrl]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(console.error);
      }
    };
  }, [sound]);

  // Playback handlers...
}
```

### Audio Player UI Pattern

Use theme colors (e.g. `colors.onPrimary` or `colors.text`) instead of hardcoded `#fff` to comply with development-guidelines.

```tsx
{audioMedia && (
  <View style={styles.audioPlayerCard}>
    <View style={styles.audioPlayerHeader}>
      <TouchableOpacity
        style={styles.playButton}
        onPress={handlePlayPause}
        disabled={!audioUrl || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.onPrimary ?? "#FFF"} />
        ) : (
          <FontAwesome name={isPlaying ? "pause" : "play"} size={16} color={colors.onPrimary ?? "#FFF"} />
        )}
      </TouchableOpacity>
      <View style={styles.audioInfo}>
        <Text style={{ color: colors.text }}>Voice Recording</Text>
      </View>
      {isPlaying && (
        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <FontAwesome name="stop" size={12} color={colors.onPrimary ?? "#FFF"} />
        </TouchableOpacity>
      )}
    </View>
  </View>
)}
```

---

## 🔍 Media File Lookup Pattern

### Finding Associated Audio Files (case-detail)

Media files for a case are loaded via `useMediaFilesByCase(caseId)`. To find the audio for a diagnosis, treatment, or note:

```typescript
// Direct lookup by mediaId (used in case-detail for diagnoses, treatments, notes)
let audioMedia: MediaFile | null | undefined = null;
if (entity.mediaId) {
  audioMedia = mediaFiles.find((m) => m.mediaId === entity.mediaId);
}

// Fallback: match by caseId and S3 key pattern (e.g. cases/${caseId}/audio/)
if (!audioMedia && caseId) {
  const audioFiles = mediaFiles.filter(
    (m) =>
      m.fileType === "AUDIO" &&
      m.s3Key?.includes(`cases/${caseId}/audio/`),
  );
  if (audioFiles.length > 0) {
    const entityCreatedAt = new Date(entity.createdAt).getTime();
    audioMedia = audioFiles.reduce((closest, current) => {
      const currentDiff = Math.abs(
        new Date(current.createdAt).getTime() - entityCreatedAt,
      );
      const closestDiff = Math.abs(
        new Date(closest.createdAt).getTime() - entityCreatedAt,
      );
      return currentDiff < closestDiff ? current : closest;
    });
  }
}
```

---

## ⚠️ Error Handling Patterns

### Recording Errors

```typescript
<VoiceMessageRecorder
  onError={(error: Error) => {
    Alert.alert("Error", error.message);
  }}
  // ... other props
/>
```

### Playback Errors

```typescript
try {
  // Audio playback logic
} catch (error) {
  Alert.alert("Error", "Failed to play audio");
  if (__DEV__) {
    console.error("[ComponentName] Playback error:", error);
  }
}
```

### Save Errors

```typescript
try {
  // Create MediaFile and Entity
} catch (error) {
  Alert.alert(
    "Error",
    error instanceof Error ? error.message : "Failed to create entity",
  );
}
```

---

## 🧹 Cleanup Patterns

### Audio Resource Cleanup

```typescript
// Always cleanup audio resources on unmount
useEffect(() => {
  return () => {
    if (sound) {
      sound.unloadAsync().catch(console.error);
    }
  };
}, [sound]);

// Cleanup before navigation
const handleSave = async () => {
  try {
    // ... save logic
  } finally {
    if (sound) {
      await sound.unloadAsync();
    }
    router.replace(`/case-detail?caseId=${caseId}`);
  }
};
```

---

## 📊 State Management Rules

### Required State Variables

```typescript
// Text input state
const [text, setText] = useState("");

// Voice recording state
const [voiceRecording, setVoiceRecording] = useState<{
  s3Key: string;
  rawText: string;
  improvedText?: string;
  localUri: string;
} | null>(null);

// Audio playback state
const [sound, setSound] = useState<Audio.Sound | null>(null);
const [isPlaying, setIsPlaying] = useState(false);
const [isLoading, setIsLoading] = useState(false);
const [audioUrl, setAudioUrl] = useState<string | null>(null);
```

### Mutation Loading States

```typescript
// Always check both mutations when disabling save button
disabled={
  !text.trim() ||
  createEntityMutation.isPending ||
  createMediaMutation.isPending
}

loading={createEntityMutation.isPending || createMediaMutation.isPending}
```

---

## 🔗 API Integration Patterns

### MediaFile Creation

```typescript
const bucketName = getBucketName();
const s3Url = `https://${bucketName}.s3.amazonaws.com/${voiceRecording.s3Key}`;

const mediaFile = await createMediaMutation.mutateAsync({
  caseId,
  fileType: "AUDIO",
  s3Key: voiceRecording.s3Key,
  url: s3Url,
});
```

### Entity Creation with mediaId

```typescript
await createEntityMutation.mutateAsync({
  caseId,
  // ... other required fields
  ...(mediaId !== undefined && { mediaId: Number(mediaId) }),
});
```

**Critical:** Always convert `mediaId` to `Number()` before sending to API. Add screens get `caseId` from `useLocalSearchParams()` (e.g. `/add-diagnosis?caseId=123`).

---

## 🎯 Section-Specific Patterns

### Diagnoses (add-diagnosis)
- Route: `/add-diagnosis?caseId={caseId}`; optional `diagnosisId` for edit
- Voice input populates `diagnosisText` field
- Status selection (SUSPECTED/CONFIRMED) is separate
- Audio playback on case-detail for diagnoses with `mediaId`

### Treatments (add-treatment)
- Route: `/add-treatment?caseId={caseId}`
- Voice input populates `instructions` field only
- Other fields (medicine, dose, route, etc.) remain text-only
- Audio playback on case-detail when treatment has `mediaId`

### Notes (add-note)
- Route: `/add-note?caseId={caseId}`
- Voice input populates `noteText` field
- `noteType` set to `"VOICE_TRANSCRIPT"` when recording; `"TEXT"` when typing only
- Audio playback on case-detail for notes with `mediaId`

### Media / Images (add-media)
- Route: `/add-media?caseId={caseId}`
- Uploads images to S3 (presigned URL or fallback), then creates `MediaFile` with `caseId`, `fileType: "IMAGE"`, `s3Key`, `url`
- S3 key pattern: `cases/${caseId}/images/...`
- After success: `router.replace(\`/case-detail?caseId=${caseId}\`)`

### VoiceMessageRecorder
- Props: `onTranscriptReady`, `onRecordingComplete`, `onError`, `buttonSize`, `buttonColor`, `caseId` (optional)
- Pass `caseId` when used on add-diagnosis, add-treatment, add-note so S3 paths can be case-scoped; use `caseId={undefined}` on screens without a case (e.g. create-animal chief complaint).

---

## ✅ Implementation Checklist

When implementing voice input for a new section:

- [ ] Add `VoiceMessageRecorder` component to input screen
- [ ] Implement `handleVoiceRecordingComplete` callback
- [ ] Implement `handleTranscriptReady` callback
- [ ] Add voice playback preview UI (play/pause/stop/record again)
- [ ] Implement `handlePlayPause` and `handleStop` handlers
- [ ] Add `createMediaMutation` hook
- [ ] Update `handleSave` to create MediaFile before entity
- [ ] Convert `mediaId` to `Number()` before API call
- [ ] Add audio cleanup in `useEffect` unmount
- [ ] Update case-detail screen to show audio playback
- [ ] Implement media file lookup (useMediaFilesByCase, entity.mediaId)
- [ ] Add error handling for all operations
- [ ] Test recording → transcription → edit → save flow
- [ ] Test audio playback on case-detail screen
- [ ] Verify cleanup on navigation

---

## 🚫 Common Pitfalls to Avoid

1. **❌ Forgetting to create MediaFile before entity**
   - Always create MediaFile first, then link `mediaId` to entity

2. **❌ Sending `mediaId` as string**
   - Always convert: `Number(mediaId)`

3. **❌ Not cleaning up audio resources**
   - Always call `sound.unloadAsync()` on unmount

4. **❌ Including `mediaId` when undefined**
   - Use conditional spread: `...(mediaId !== undefined && { mediaId })`

5. **❌ Not handling loading states for both mutations**
   - Check both `createEntityMutation.isPending` AND `createMediaMutation.isPending`

6. **❌ Not providing fallback media lookup**
   - Implement both direct lookup (by `mediaId`) and fallback (by caseId + S3 key pattern / timestamp)

---

## 📝 Code Examples

### Complete Add Screen Pattern

See reference implementations:
- `src/app/add-note.tsx` - Full voice input implementation
- `src/app/add-diagnosis.tsx` - Voice input with status selection
- `src/app/add-treatment.tsx` - Voice input for instructions field only

### Complete Detail Screen Pattern

See reference implementation:
- `src/app/case-detail.tsx` - Case detail with audio playback for diagnoses, treatments, and notes

---

## 🔄 Future Enhancements

Potential improvements to consider:

1. **Batch Media Creation**: Create multiple MediaFiles in parallel
2. **Offline Support**: Queue media creation when offline
3. **Audio Compression**: Compress audio before upload
4. **Transcription Editing**: Allow editing transcript before final save
5. **Audio Waveform Visualization**: Show audio waveform during playback
6. **Voice Commands**: Support voice commands for navigation

---

## 📚 Related Documentation

- `development-guidelines.md` - General coding standards
- `VoiceMessageRecorder.tsx` - Component implementation details
- Backend API documentation - MediaFile and entity schemas

---

**Maintainer:** Development Team  
**Last Review:** February 2026
