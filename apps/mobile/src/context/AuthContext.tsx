import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, initAuth } from "@/lib/auth";

type AuthContextType = {
  isSignedIn: boolean;
  setIsSignedIn: (v: boolean) => void;
  authReady: boolean;
};

const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  setIsSignedIn: () => {},
  authReady: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    initAuth().then(() => {
      setIsSignedIn(!!getCurrentUser());
      setAuthReady(true);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ isSignedIn, setIsSignedIn, authReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
