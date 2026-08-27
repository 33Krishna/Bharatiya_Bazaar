import React, { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "MEMBER" | "VENDOR" | "ADMIN" | null;

export interface LoginContextType {
  cardNumber: string;
  cardType: string;
  isSubCard: boolean;
  ownerMemberCode: string | null;
}

interface AuthContextType {
  token: string | null;
  role: UserRole;
  user: any | null;
  loginContext: LoginContextType | null;
  isAuthenticated: boolean;
  login: (token: string, role: UserRole, user: any, loginContext?: LoginContextType | null) => void;
  logout: () => void;
  updateLoginContext: (context: LoginContextType) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("bb_token"));
  const [role, setRole] = useState<UserRole>(localStorage.getItem("bb_role") as UserRole);
  const [user, setUser] = useState<any | null>(() => {
    const savedUser = localStorage.getItem("bb_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loginContext, setLoginContext] = useState<LoginContextType | null>(() => {
    const savedCtx = localStorage.getItem("bb_login_context");
    return savedCtx ? JSON.parse(savedCtx) : null;
  });

  const isAuthenticated = !!token;

  const login = (
    newToken: string,
    newRole: UserRole,
    newUser: any,
    newCtx: LoginContextType | null = null
  ) => {
    setToken(newToken);
    setRole(newRole);
    setUser(newUser);
    setLoginContext(newCtx);

    localStorage.setItem("bb_token", newToken);
    localStorage.setItem("bb_role", newRole || "");
    localStorage.setItem("bb_user", JSON.stringify(newUser));
    if (newCtx) {
      localStorage.setItem("bb_login_context", JSON.stringify(newCtx));
    } else {
      localStorage.removeItem("bb_login_context");
    }
  };

  const logout = () => {
    setToken(null);
    setRole(null);
    setUser(null);
    setLoginContext(null);

    localStorage.removeItem("bb_token");
    localStorage.removeItem("bb_role");
    localStorage.removeItem("bb_user");
    localStorage.removeItem("bb_login_context");
  };

  const updateLoginContext = (context: LoginContextType) => {
    setLoginContext(context);
    localStorage.setItem("bb_login_context", JSON.stringify(context));
  };

  // Setup Axios global headers if token changes
  useEffect(() => {
    // We can do global configuration or pass token directly in api calls
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        token,
        role,
        user,
        loginContext,
        isAuthenticated,
        login,
        logout,
        updateLoginContext
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
