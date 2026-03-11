import { Tabs } from 'expo-router';
import { Package, Settings } from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import { useGps } from '../../hooks/useGps';

function GpsTracker() {
  const { idTrasportatore } = useAuth();
  useGps(idTrasportatore ?? null);
  return null;
}

export default function TabsLayout() {
  const { isAdmin } = useAuth();
  return (
    <>
      <GpsTracker />
      <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarStyle: isAdmin ? { borderTopColor: '#f1f5f9' } : { display: 'none' },
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
    </>
  );
}
