import { useCallback, useEffect } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect, useNavigation, usePreventRemove } from "expo-router";

type BackGuardOptions = {
  shouldHandleBack: () => boolean;
  onBack: () => void;
  allowExitRef?: { current: boolean };
  hideHeader?: boolean;
};

export function useBackNavigationGuard({
  shouldHandleBack,
  onBack,
  allowExitRef,
  hideHeader = false,
}: BackGuardOptions) {
  const navigation = useNavigation();

  usePreventRemove(
    !allowExitRef?.current && shouldHandleBack(),
    ({ data, repeat }) => {
      if (allowExitRef?.current || !shouldHandleBack()) {
        repeat();
        return;
      }
      if (data.action.type === "GO_BACK" || data.action.type === "POP") {
        onBack();
      } else {
        repeat();
      }
    },
  );

  useEffect(() => {
    if (!hideHeader) return;
    navigation.setOptions({ headerShown: false });
  }, [hideHeader, navigation]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (allowExitRef?.current) return false;
        if (!shouldHandleBack()) return false;
        onBack();
        return true;
      };
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onHardwareBack,
      );
      return () => {
        subscription.remove();
      };
    }, [allowExitRef, navigation, onBack, shouldHandleBack]),
  );
}
