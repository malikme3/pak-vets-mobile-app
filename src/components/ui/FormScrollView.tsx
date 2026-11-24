import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from "react";
import {
  findNodeHandle,
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type ScrollViewInstance,
  type ScrollViewProps,
} from "react-native";

const fieldClearance = 16;
const handledFocusEvents = new WeakSet<object>();
type FocusedInput = NonNullable<
  ReturnType<typeof TextInput.State.currentlyFocusedInput>
>;

export function FormScrollView({
  ref,
  onFocus,
  onLayout,
  onScroll,
  automaticallyAdjustKeyboardInsets = Platform.OS === "ios",
  keyboardShouldPersistTaps = "handled",
  ...props
}: ScrollViewProps & { ref?: Ref<ScrollViewInstance> }) {
  const scroll = useRef<ScrollViewInstance>(null);
  const focusedInput = useRef<FocusedInput | null>(null);
  const scrollOffset = useRef(0);
  const frame = useRef<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useImperativeHandle(ref, () => scroll.current!, []);

  const revealFocusedInput = useCallback((keyboardTop?: number) => {
    if (Platform.OS === "web" || !focusedInput.current) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const input = focusedInput.current;
      const view = scroll.current;
      if (!input || !view || TextInput.State.currentlyFocusedInput() !== input)
        return;

      view.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
        const keyboardY =
          keyboardTop ?? Keyboard.metrics()?.screenY ?? Infinity;
        const visibleBottom =
          Math.min(top + height, keyboardY) - fieldClearance;
        const visibleTop = top + fieldClearance;
        if (visibleBottom <= visibleTop) return;

        input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
          if (
            scroll.current !== view ||
            focusedInput.current !== input ||
            TextInput.State.currentlyFocusedInput() !== input
          )
            return;

          const inputBottom =
            inputTop + Math.min(inputHeight, visibleBottom - visibleTop);
          const delta =
            inputTop < visibleTop
              ? inputTop - visibleTop
              : Math.max(0, inputBottom - visibleBottom);
          if (Math.abs(delta) > 1) {
            view.scrollTo({
              y: Math.max(0, scrollOffset.current + delta),
              animated: true,
            });
          }
        });
      });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const revealAfterLayout = (screenY: number) => {
      revealFocusedInput(screenY);
      if (revealTimer.current !== null) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => {
        revealTimer.current = null;
        revealFocusedInput(screenY);
      }, 120);
    };
    const shown = Keyboard.addListener("keyboardDidShow", (event) =>
      revealAfterLayout(event.endCoordinates.screenY),
    );
    const changed =
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardDidChangeFrame", (event) =>
            revealAfterLayout(event.endCoordinates.screenY),
          )
        : undefined;
    return () => {
      shown.remove();
      changed?.remove();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (revealTimer.current !== null) clearTimeout(revealTimer.current);
    };
  }, [revealFocusedInput]);

  return (
    <ScrollView
      {...props}
      ref={scroll}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollEventThrottle={props.scrollEventThrottle ?? 16}
      onFocus={(event) => {
        if (
          Platform.OS !== "web" &&
          !handledFocusEvents.has(event.nativeEvent)
        ) {
          const input = TextInput.State.currentlyFocusedInput();
          if (input && findNodeHandle(input) === event.nativeEvent.target) {
            // The nearest form scroll view owns the focused input, including sheets.
            handledFocusEvents.add(event.nativeEvent);
            focusedInput.current = input;
            revealFocusedInput();
          }
        }
        onFocus?.(event);
      }}
      onLayout={(event) => {
        onLayout?.(event);
        revealFocusedInput();
      }}
      onScroll={(event) => {
        scrollOffset.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
    />
  );
}
