import { AudioLines, FileText, SlidersHorizontal } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useThemeColor } from 'heroui-native';

export default function TabLayout() {
  const [background, border, accent, muted, panel] = useThemeColor([
    'background',
    'border',
    'accent',
    'muted',
    'surface',
  ]);

  return (
    <>
      {/* oxlint-disable-next-line react/style-prop-object -- expo-status-bar's `style` prop is a
      theme string ("auto" | "dark" | "light"), not a React Native style object. */}
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: background },
          tabBarStyle: {
            backgroundColor: panel,
            borderTopColor: border,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarActiveTintColor: accent,
          tabBarInactiveTintColor: muted,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Project',
            tabBarIcon: ({ color, size }) => <FileText color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="editor"
          options={{
            title: 'Editor',
            tabBarIcon: ({ color, size }) => <SlidersHorizontal color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="compare"
          options={{
            title: 'Compare',
            tabBarIcon: ({ color, size }) => <AudioLines color={color} size={size ?? 24} />,
          }}
        />
      </Tabs>
    </>
  );
}
