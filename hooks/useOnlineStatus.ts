import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  const [isOnline, setOnline] = useState(true);
  useEffect(() => {
    try {
      const { default: NI } = require('@react-native-community/netinfo');
      const unsub = NI.addEventListener((state: any) => setOnline(!!state.isConnected));
      return unsub;
    } catch { return; }
  }, []);
  return isOnline;
}
