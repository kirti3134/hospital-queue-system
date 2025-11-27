// Storage utility with SSR compatibility
const isClient = typeof window !== 'undefined';

export const safeLocalStorage = {
  getItem: (key) => {
    if (!isClient) return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('localStorage.getItem failed:', error);
      return null;
    }
  },
  
  setItem: (key, value) => {
    if (!isClient) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('localStorage.setItem failed:', error);
    }
  },
  
  removeItem: (key) => {
    if (!isClient) return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('localStorage.removeItem failed:', error);
    }
  }
};

export const safeSessionStorage = {
  getItem: (key) => {
    if (!isClient) return null;
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      console.warn('sessionStorage.getItem failed:', error);
      return null;
    }
  },
  
  setItem: (key, value) => {
    if (!isClient) return;
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      console.warn('sessionStorage.setItem failed:', error);
    }
  },
  
  removeItem: (key) => {
    if (!isClient) return;
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn('sessionStorage.removeItem failed:', error);
    }
  }
};

// Mock localStorage for SSR environments
if (!isClient) {
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    length: 0,
    key: () => null
  };
  
  global.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    length: 0,
    key: () => null
  };
}