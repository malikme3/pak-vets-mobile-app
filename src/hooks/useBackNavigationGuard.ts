import { useCallback, useEffect } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect, useNavigation } from "expo-router";

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

  useEffect(() => {
    if (!hideHeader) return;
    navigation.setOptions({ headerShown: false });
  }, [hideHeader, navigation]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (!shouldHandleBack()) return false;
        onBack();
        return true;
      };
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onHardwareBack,
      );
      const beforeRemove = navigation.addListener("beforeRemove", (event) => {
        if (allowExitRef?.current) return;
        if (!shouldHandleBack()) return;
        const actionType = event.data.action?.type;
        if (actionType !== "GO_BACK" && actionType !== "POP") return;
        event.preventDefault();
        onBack();
      });
      return () => {
        subscription.remove();
        beforeRemove();
      };
    }, [allowExitRef, navigation, onBack, shouldHandleBack]),
  );
}
