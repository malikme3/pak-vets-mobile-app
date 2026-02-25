import { useCallback, useMemo } from "react";

type UseStepFlowOptions<T extends string> = {
  steps: readonly T[];
  currentStep: T;
  setStep: (step: T) => void;
  onExitFirst?: () => void;
};

export function useStepFlow<T extends string>({
  steps,
  currentStep,
  setStep,
  onExitFirst,
}: UseStepFlowOptions<T>) {
  const currentIndex = useMemo(
    () =>
      Math.max(
        0,
        steps.findIndex((s) => s === currentStep),
      ),
    [currentStep, steps],
  );
  const totalSteps = steps.length;
  const isFirstStep = currentIndex <= 0;
  const isLastStep = currentIndex >= totalSteps - 1;
  const progressPercent =
    totalSteps === 0 ? 0 : ((currentIndex + 1) / totalSteps) * 100;

  const goBack = useCallback(() => {
    if (isFirstStep) {
      onExitFirst?.();
      return;
    }
    const previous = steps[currentIndex - 1];
    if (previous) setStep(previous);
  }, [currentIndex, isFirstStep, onExitFirst, setStep, steps]);

  return {
    currentIndex,
    totalSteps,
    progressPercent,
    isFirstStep,
    isLastStep,
    goBack,
  };
}
