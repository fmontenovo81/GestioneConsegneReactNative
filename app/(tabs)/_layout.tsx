import { Tabs } from 'expo-router';
import { Package, Settings } from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';

export default function TabsLayout() {
  const { isAdmin } = useAuth();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#2563eb',
      tabBarStyle: { borderTopColor: '#f1f5f9' },
    }}>
      <Tabs.Screen
        name="consegne"
        options={{
          title: 'Consegne',
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
        }}
      />
      {isAdmin && (
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Back Office',
            tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
          }}
        />
      )}
    </Tabs>
  );
}
