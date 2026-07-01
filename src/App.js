import React, { useState, useEffect } from "react";
import KarigarBook from "./KarigarBook";
import { auth } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState("Admin");
  const [role, setRole] = useState("admin");
  const [password, setPassword] = useState("");
  const [loginAttempt, setLoginAttempt] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("karigarAdminUser");
    if (user) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Admin password check
      if (password === "karigar@123") {
        setIsAuthenticated(true);
        setCurrentUser("Admin");
        setRole("admin");
        localStorage.setItem("karigarAdminUser", "Admin");
        setPassword("");
      } else {
        setLoginAttempt(true);
      }
    } catch (error) {
      console.error("Login error:", error);
      setLoginAttempt(true);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser("");
    setRole("");
    localStorage.removeItem("karigarAdminUser");
  };

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#0D1B2A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            backgroundColor: "#162336",
            padding: "40px",
            borderRadius: "12px",
            maxWidth: "400px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <h1 style={{ color: "#F4D35E", marginBottom: "30px", fontSize: "24px" }}>
            Gemsstar Karigar Book
          </h1>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  color: "#C9C9C9",
                  marginBottom: "8px",
                  fontSize: "14px",
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "16px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {loginAttempt && (
              <div style={{ color: "#FF6B6B", marginBottom: "15px", fontSize: "14px" }}>
                Invalid password
              </div>
            )}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#F4D35E",
                color: "#0D1B2A",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0D1B2A" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#162336",
          padding: "12px 20px",
          borderBottom: "1px solid #1E3048",
        }}
      >
        <h1 style={{ color: "#F4D35E", margin: 0, fontSize: "18px" }}>
          Karigar Book
        </h1>
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 16px",
            backgroundColor: "transparent",
            color: "#F4D35E",
            border: "1px solid #F4D35E",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Logout
        </button>
      </div>
      <KarigarBook currentUser={currentUser} role={role} />
    </div>
  );
}


