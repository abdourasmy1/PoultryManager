import React from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  View,
  Text,
  Pressable,
  Platform,
} from "react-native";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider, useApp } from "./lib/context";
import { AppNavigator } from "./components/Navigation";
import { SheetHost } from "./components/Sheets";
import { LicenseGate } from "./components/LicenseGate";
import { Icon, Row, T, Button } from "./components/ui";
import { t } from "./lib/ar";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#F7F8FA",
            padding: 30,
            gap: 20,
          }}
        >
          <Text
            style={{
              fontFamily: "Tajawal",
              fontSize: 19,
              textAlign: "center",
              color: "#216A50",
            }}
          >
            {t("safeError")}
          </Text>
          <Pressable
            onPress={() =>
              Platform.OS === "web"
                ? window.location.reload()
                : this.setState({ error: false })
            }
          >
            <Text style={{ fontFamily: "Tajawal-Bold", color: "#216A50" }}>
              {t("retry")}
            </Text>
          </Pressable>
        </View>
      );
    return this.props.children;
  }
}
function Workspace() {
  const { repo, error, reload, theme, toast } = useApp();
  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <StatusBar style={theme.bg === "#141C19" ? "light" : "dark"} />
      {!repo ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          {error ? (
            <>
              <Icon name="cloud-offline-outline" size={40} />
              <T>{t("safeError")}</T>
              <Button label={t("retry")} onPress={reload} />
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={theme.primary} />
              <T style={{ color: theme.muted }}>{t("loading")}</T>
            </>
          )}
        </View>
      ) : (
        <LicenseGate>
          <AppNavigator />
          <SheetHost />
        </LicenseGate>
      )}
      {!!toast && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 85,
            alignSelf: "center",
            maxWidth: "90%",
            paddingHorizontal: 21,
            paddingVertical: 14,
            backgroundColor: "#244F3D",
            borderRadius: 12,
            shadowColor: "#000",
            shadowOpacity: 0.16,
            shadowRadius: 20,
            elevation: 10,
            zIndex: 9999,
          }}
        >
          <Row style={{ gap: 10 }}>
            <Icon name="checkmark-circle-outline" size={20} color="#D3EACF" />
            <T style={{ color: "#fff", fontSize: 13, flexShrink: 1 }}>
              {toast}
            </T>
          </Row>
        </View>
      )}
    </SafeAreaView>
  );
}
export default function App() {
  const [loaded] = useFonts({
    ...Ionicons.font,
    Tajawal: require("./assets/fonts/Tajawal-Regular.ttf"),
    "Tajawal-Medium": require("./assets/fonts/Tajawal-Medium.ttf"),
    "Tajawal-Bold": require("./assets/fonts/Tajawal-Bold.ttf"),
  });
  if (!loaded)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F7F8FA",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color="#216A50" />
      </View>
    );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppProvider>
            <Workspace />
          </AppProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
