/**
 * Auth helpers for the Electron renderer process.
 * Uses amazon-cognito-identity-js with window.localStorage (default storage).
 */
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from "amazon-cognito-identity-js";

const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_USER_POOL_ID as string,
  ClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID as string,
});

export function getCurrentUser(): CognitoUser | null {
  return userPool.getCurrentUser();
}

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
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.authenticateUser(
      new AuthenticationDetails({ Username: email, Password: password }),
      { onSuccess: () => resolve(), onFailure: reject },
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
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.confirmRegistration(code, true, (err) => (err ? reject(err) : resolve()));
  });
}

export function signOut(): void {
  userPool.getCurrentUser()?.signOut();
}
