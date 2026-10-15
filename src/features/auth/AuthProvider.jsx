import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
  } from "react";
  
  import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile,
  } from "firebase/auth";
  
  import { auth, firebaseConfigured } from "../../lib/firebase";
  
  const AuthContext = createContext(null);
  
  export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
  
    useEffect(() => {
      return onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
    }, []);
  
    const value = useMemo(
      () => ({
        user,
        loading,
        firebaseConfigured,
  
        signIn: (email, password) =>
          signInWithEmailAndPassword(auth, email, password),
  
        signUp: async (name, email, password) => {
          const result = await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );
  
          await updateProfile(result.user, {
            displayName: name,
          });
  
          return result;
        },
  
        signOut: () => signOut(auth),
  
        resetPassword: (email) =>
          sendPasswordResetEmail(auth, email),
      }),
      [user, loading]
    );
  
    return (
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    );
  }
  
  export function useAuth() {
    return useContext(AuthContext);
  }