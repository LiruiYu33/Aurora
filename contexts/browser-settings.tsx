import { createContext, PropsWithChildren, useContext, useState } from 'react';

const DEFAULT_HOME_URL = 'https://www.google.com/';

type BrowserSettingsContextValue = {
  homeUrl: string;
  setHomeUrl: (url: string) => void;
};

const BrowserSettingsContext = createContext<BrowserSettingsContextValue | undefined>(undefined);

export function BrowserSettingsProvider({ children }: PropsWithChildren) {
  const [homeUrl, setHomeUrl] = useState(DEFAULT_HOME_URL);

  return (
    <BrowserSettingsContext.Provider value={{ homeUrl, setHomeUrl }}>
      {children}
    </BrowserSettingsContext.Provider>
  );
}

export function useBrowserSettings() {
  const context = useContext(BrowserSettingsContext);
  if (!context) {
    throw new Error('useBrowserSettings 必须在 BrowserSettingsProvider 内部使用');
  }
  return context;
}
