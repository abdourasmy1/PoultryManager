import { Alert, Platform } from "react-native";
import { t } from "./ar";
export function ask(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web")
    return Promise.resolve(window.confirm(title + "\n\n" + message));
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: t("cancel"), style: "cancel", onPress: () => resolve(false) },
        {
          text: t("confirm"),
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
