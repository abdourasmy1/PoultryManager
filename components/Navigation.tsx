import React, { useEffect } from "react";
import { View, Pressable, useWindowDimensions, Platform } from "react-native";
import {
  NavigationContainer,
  createNavigationContainerRef,
  DefaultTheme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { useApp, Page } from "../lib/context";
import { t, TextKey } from "../lib/ar";
import { formatDate } from "../lib/domain";
import { Icon, IconButton, IconName, Row, T } from "./ui";
import Dashboard from "../screens/Dashboard";
import PaymentsScreen from "../screens/PaymentsScreen";
import {
  AccountsScreen,
  DocumentScreen,
  InventoryScreen,
  MoreScreen,
  ReportsScreen,
  SettingsScreen,
} from "../screens/BusinessScreens";
const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const navRef = createNavigationContainerRef<any>();
const navItems: { page: Page; label: TextKey; icon: IconName }[] = [
  { page: "dashboard", label: "dashboard", icon: "grid-outline" },
  { page: "sales", label: "sales", icon: "trending-up-outline" },
  { page: "purchases", label: "purchases", icon: "bag-handle-outline" },
  { page: "accounts", label: "accounts", icon: "people-outline" },
  { page: "inventory", label: "inventory", icon: "cube-outline" },
  {
    page: "transactions",
    label: "transactions",
    icon: "swap-horizontal-outline",
  },
  { page: "reports", label: "reports", icon: "bar-chart-outline" },
  { page: "expenses", label: "expenses", icon: "receipt-outline" },
  { page: "settings", label: "settings", icon: "settings-outline" },
];
function Sidebar() {
  const { theme, page, setPage, settings, open } = useApp();
  return (
    <View
      style={{
        width: 229,
        backgroundColor: theme.sidebar,
        borderLeftWidth: 1,
        borderColor: theme.border,
        paddingHorizontal: 18,
        paddingTop: 28,
        paddingBottom: 19,
      }}
    >
      <Pressable onPress={() => setPage("dashboard")}>
        <Row style={{ gap: 10, paddingHorizontal: 5, marginBottom: 34 }}>
          <View
            style={{
              width: 43,
              height: 45,
              backgroundColor: "#216A50",
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              source={require("../assets/images/brand.svg")}
              contentFit="contain"
              style={{ width: 36, height: 36 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <T bold style={{ fontSize: 21, lineHeight: 28 }}>
              {t("appName")}
            </T>
            <T style={{ fontSize: 9, color: theme.muted }}>{t("tagline")}</T>
          </View>
        </Row>
      </Pressable>
      <T
        style={{
          fontSize: 10,
          color: theme.muted,
          paddingHorizontal: 13,
          marginBottom: 13,
        }}
      >
        {t("manageBusiness")}
      </T>
      {navItems.map((item, n) => (
        <React.Fragment key={item.page}>
          {n === 5 && (
            <>
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.border,
                  marginVertical: 22,
                  marginHorizontal: 10,
                }}
              />
              <T
                style={{
                  fontSize: 10,
                  color: theme.muted,
                  paddingHorizontal: 13,
                  marginBottom: 13,
                }}
              >
                {t("manage")}
              </T>
            </>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(item.label)}
            onPress={() => setPage(item.page)}
            style={({ hovered, pressed }: any) => ({
              paddingHorizontal: 13,
              paddingVertical: 12,
              borderRadius: 8,
              marginBottom: 5,
              backgroundColor:
                page === item.page
                  ? theme.primarySoft
                  : hovered || pressed
                    ? theme.surface2
                    : "transparent",
              minHeight: 46,
            })}
          >
            <Row style={{ gap: 13 }}>
              <Icon
                name={item.icon}
                size={19}
                color={page === item.page ? theme.primary : theme.secondary}
              />
              <T
                bold={page === item.page}
                medium={page !== item.page}
                style={{
                  fontSize: 13,
                  color: page === item.page ? theme.primary : theme.secondary,
                  flex: 1,
                }}
              >
                {t(item.label)}
              </T>
              {page === item.page && (
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: theme.primary,
                  }}
                />
              )}
            </Row>
          </Pressable>
        </React.Fragment>
      ))}
      <View style={{ flex: 1, minHeight: 35 }} />
      <Pressable
        onPress={() => open({ type: "help" })}
        style={{
          backgroundColor: theme.surface2,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <Row style={{ gap: 8, marginBottom: 6 }}>
          <View
            style={{
              width: 27,
              height: 27,
              backgroundColor: theme.primarySoft,
              borderRadius: 9,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="chatbubbles-outline" size={15} color={theme.primary} />
          </View>
          <T bold style={{ fontSize: 12 }}>
            {t("help")}
          </T>
        </Row>
        <T style={{ fontSize: 10, color: theme.muted }}>{t("helpHint")}</T>
        <Row style={{ gap: 5, marginTop: 9 }}>
          <T medium style={{ fontSize: 10, color: theme.primary }}>
            {t("helpAction")}
          </T>
          <Icon name="arrow-back" size={12} color={theme.primary} />
        </Row>
      </Pressable>
      <Pressable onPress={() => setPage("settings")}>
        <Row
          style={{
            gap: 10,
            borderTopWidth: 1,
            borderColor: theme.border,
            paddingTop: 18,
            paddingHorizontal: 3,
          }}
        >
          <View
            style={{
              width: 35,
              height: 35,
              borderRadius: 12,
              backgroundColor: "#EDE7DA",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T bold style={{ fontSize: 16, color: "#756743" }}>
              {settings.business_name?.charAt(0) || "م"}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T bold style={{ fontSize: 11 }} numberOfLines={1}>
              {settings.business_name || t("owner")}
            </T>
            <T style={{ fontSize: 9, color: theme.muted }}>
              {t("localAccount")}
            </T>
          </View>
          <Icon name="chevron-back" size={14} color={theme.muted} />
        </Row>
      </Pressable>
    </View>
  );
}
function Header() {
  const { theme, page, open, settings } = useApp();
  const width = useWindowDimensions().width;
  const mobile = width < 800;
  const label =
    navItems.find((i) => i.page === page)?.label || (page as TextKey);
  return (
    <Row
      style={{
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderColor: theme.border,
        height: 80,
        paddingHorizontal: mobile ? 19 : 30,
        gap: 20,
        justifyContent: "space-between",
      }}
    >
      <View>
        <Row style={{ gap: 7 }}>
          <T style={{ fontSize: 11, color: theme.muted }}>{t("workspace")}</T>
          <Icon name="chevron-back" size={10} color={theme.muted} />
          <T medium style={{ fontSize: 11, color: theme.primary }}>
            {t(label)}
          </T>
        </Row>
        <T bold style={{ fontSize: 15, marginTop: 3 }}>
          {settings.business_name ||
            t(page === "dashboard" ? "overview" : label)}
        </T>
      </View>
      <View style={{ flex: 1 }} />
      {!mobile && (
        <Pressable
          accessibilityLabel={t("search")}
          onPress={() => open({ type: "search" })}
          style={{
            width: width > 1200 ? 293 : 220,
            backgroundColor: theme.surface2,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 9,
            paddingHorizontal: 13,
            height: 38,
            justifyContent: "center",
          }}
        >
          <Row style={{ gap: 8 }}>
            <Icon name="search-outline" size={17} color={theme.muted} />
            <T style={{ fontSize: 11, color: theme.muted, flex: 1 }}>
              {t("search")}
            </T>
            <View
              style={{
                paddingHorizontal: 5,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 4,
              }}
            >
              <T number style={{ fontSize: 9, color: theme.muted }}>
                ⌘ K
              </T>
            </View>
          </Row>
        </Pressable>
      )}
      <Row style={{ gap: mobile ? 5 : 12 }}>
        {mobile && (
          <IconButton
            label={t("search")}
            icon="search-outline"
            onPress={() => open({ type: "search" })}
          />
        )}
        <View>
          <IconButton
            label={t("notifications")}
            icon="notifications-outline"
            onPress={() => open({ type: "notifications" })}
          />
          {(!settings.business_name || !settings.last_backup) && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 10,
                top: 8,
                width: 5,
                height: 5,
                borderRadius: 4,
                backgroundColor: "#D0A35A",
                borderWidth: 1,
                borderColor: theme.surface,
              }}
            />
          )}
        </View>
        {!mobile && (
          <View
            style={{ width: 1, height: 24, backgroundColor: theme.border }}
          />
        )}
        {!mobile && (
          <Row style={{ gap: 7 }}>
            <Icon name="calendar-clear-outline" size={15} color={theme.muted} />
            <T number style={{ fontSize: 11, color: theme.secondary }}>
              {formatDate(Date.now())}
            </T>
          </Row>
        )}
      </Row>
    </Row>
  );
}
function Sales() {
  return <DocumentScreen kind="sale" />;
}
function Purchases() {
  return <DocumentScreen kind="purchase" />;
}
function MoreRoute() {
  const { page } = useApp();
  if (page === "inventory") return <InventoryScreen />;
  if (page === "transactions") return <DocumentScreen />;
  if (page === "reports") return <ReportsScreen />;
  if (page === "expenses") return <DocumentScreen kind="expense" />;
  if (page === "payments") return <PaymentsScreen />;
  if (page === "settings") return <SettingsScreen />;
  return <MoreScreen />;
}
const routeFor = (page: Page) =>
  page === "dashboard"
    ? "Home"
    : page === "sales"
      ? "Sales"
      : page === "purchases"
        ? "Purchases"
        : page === "accounts"
          ? "Accounts"
          : "More";
function Shell() {
  const { theme, page, setPage, open } = useApp();
  const width = useWindowDimensions().width;
  const desktop = width >= 900;
  useEffect(() => {
    if (navRef.isReady()) navRef.navigate("Main", { screen: routeFor(page) });
  }, [page]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        open({ type: "search" });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row-reverse",
        backgroundColor: theme.bg,
      }}
    >
      {desktop && <Sidebar />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Header />
        <Tabs.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            animation: "fade",
            sceneStyle: { backgroundColor: theme.bg },
            tabBarActiveTintColor: theme.primary,
            tabBarInactiveTintColor: theme.muted,
            tabBarStyle: desktop
              ? { display: "none" }
              : {
                  height: 70,
                  paddingTop: 8,
                  paddingBottom: 9,
                  backgroundColor: theme.surface,
                  borderTopColor: theme.border,
                  flexDirection: "row-reverse",
                },
            tabBarLabelStyle: {
              fontFamily: "Tajawal-Medium",
              fontSize: 10,
              marginTop: 4,
            },
            tabBarItemStyle: { borderRadius: 10 },
          }}
        >
          {[
            {
              name: "Home",
              page: "dashboard",
              label: "dashboard",
              icon: "grid-outline",
              component: Dashboard,
            },
            {
              name: "Sales",
              page: "sales",
              label: "sales",
              icon: "trending-up-outline",
              component: Sales,
            },
            {
              name: "Purchases",
              page: "purchases",
              label: "purchases",
              icon: "bag-handle-outline",
              component: Purchases,
            },
            {
              name: "Accounts",
              page: "accounts",
              label: "accounts",
              icon: "people-outline",
              component: AccountsScreen,
            },
            {
              name: "More",
              page: "more",
              label: "more",
              icon: "ellipsis-horizontal",
              component: MoreRoute,
            },
          ].map((item) => (
            <Tabs.Screen
              key={item.name}
              name={item.name}
              component={item.component}
              listeners={{ tabPress: () => setPage(item.page as Page) }}
              options={{
                title: t(item.label as TextKey),
                tabBarIcon: ({ color, size }) => (
                  <Icon name={item.icon as IconName} color={color} size={21} />
                ),
              }}
            />
          ))}
        </Tabs.Navigator>
      </View>
    </View>
  );
}
export function AppNavigator() {
  const { theme } = useApp();
  return (
    <NavigationContainer
      ref={navRef}
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.bg,
          card: theme.surface,
          text: theme.text,
          border: theme.border,
          primary: theme.primary,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={Shell} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
