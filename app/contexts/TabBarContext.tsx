import React, { createContext, useContext, useState, useCallback } from 'react';

interface TabBarContextType {
  tabBarVisible: boolean;
  setTabBarVisible: (visible: boolean) => void;
}

const TabBarContext = createContext<TabBarContextType>({
  tabBarVisible: true,
  setTabBarVisible: () => {},
});

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const [tabBarVisible, setTabBarVisibleState] = useState(true);

  const setTabBarVisible = useCallback((visible: boolean) => {
    setTabBarVisibleState(visible);
  }, []);

  return (
    <TabBarContext.Provider value={{ tabBarVisible, setTabBarVisible }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  return useContext(TabBarContext);
}
