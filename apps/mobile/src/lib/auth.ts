/**
 * Thin wrapper around amazon-cognito-identity-js for React Native.
 *
 * Uses an in-memory cache backed by AsyncStorage so the SDK's synchronous
 * ICognitoStorage interface is satisfied while tokens survive app restarts.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserAttribute,
  type ICognitoStorage,
} from "amazon-cognito-identity-js";
import { COGNITO } from "@/config/cognito";

// Synchronous in-memory cache populated from AsyncStorage on init.
const memCache: Record<string, string> = {};

const storage: ICognitoStorage = {
  setItem(key, value) {
    memCache[key] = value;
    void AsyncStorage.setItem(key, value);
  },
  getItem(key) {
    return memCache[key] ?? null;
  },
  removeItem(key) {
    delete memCache[key];
    void AsyncStorage.removeItem(key);
  },
  clear() {
    Object.keys(memCache).forEach((k) => delete memCache[k]);
    void AsyncStorage.clear();
  },
};

const userPool = new CognitoUserPool({
  UserPoolId: COGNITO.userPoolId,
  ClientId: COGNITO.userPoolClientId,
  Storage: storage,
});

/** Populate the in-memory cache from AsyncStorage (call once on app start). */
export async function initAuth(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cognitoKeys = keys.filter(
    (k) => k.startsWith("CognitoIdentityServiceProvider"),
  );
  if (cognitoKeys.length > 0) {
    const pairs = await AsyncStorage.multiGet(cognitoKeys);
    pairs.forEach(([k, v]) => { if (v) memCache[k] = v; });
  }
}

export function getCurrentUser(): CognitoUser | null {
  return userPool.getCurrentUser();
}

/** Returns the current access token, refreshing silently if needed. */
export function getAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const user = userPool.getCurrentUser();
    if (!user) { reject(new Error("Not authenticated")); return; }
    user.getSession((err: Error | null, session: { isValid(): boolean; getAccessToken(): { getJwtToken(): string } } | null) => {
      if (err || !session?.isValid()) { reject(err ?? new Error("Session invalid")); return; }
      resolve(session.getAccessToken().getJwtToken());
    });
  });
}

export function signIn(email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool, Storage: storage });
    user.authenticateUser(
      new AuthenticationDetails({ Username: email, Password: password }),
      {
        onSuccess: () => resolve(),
        onFailure: reject,
      },
    );
  });
}

export function signUp(email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    userPool.signUp(
      email,
      password,
      [new CognitoUserAttribute({ Name: "email", Value: email })],
      [],
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool, Storage: storage });
    user.confirmRegistration(code, true, (err) => (err ? reject(err) : resolve()));
  });
}

export function signOut(): void {
  userPool.getCurrentUser()?.signOut();
}
