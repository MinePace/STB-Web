import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";

function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem("token") !== null);

  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn) {
      navigate("/"); // Redirect logged-in users to home
    }
  }, [isLoggedIn, navigate]);

  const toggleForm = () => setIsRegistering(!isRegistering);

  // 🔹 Handle Enter key press for login/register
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      isRegistering ? handleRegister() : handleLogin();
    }
  };

  // 🔹 Register
  const handleRegister = async () => {
    const response = await fetch("https://stbleague.fly.dev/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, email }),
    });

    const data = await response.json();
    alert(data.message);
  };

  // 🔹 Login
  const handleLogin = async () => {
    const response = await fetch("https://stbleaguedata.vercel.app/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    console.log(data);

    if (response.ok) {
      alert("Login successful");
      localStorage.setItem("token", data.token);
      setIsLoggedIn(true);
      navigate("/"); // Redirect to homepage
    } else {
      alert(data.message);
    }
  };

  // 🔹 Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    setRole("user");
    alert("Logged out");
    navigate("/login");
  };

  return (
    <div className="login-container">
      <div className="login-form">
        {isLoggedIn ? (
          <>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <h1>{isRegistering ? "Register" : "Login"}</h1>
            <label>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              onKeyDown={handleKeyDown} 
            />

            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              onKeyDown={handleKeyDown} 
            />

            {isRegistering && (
              <>
                <label>Email</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  onKeyDown={handleKeyDown} 
                />
              </>
            )}

            <button onClick={isRegistering ? handleRegister : handleLogin}>
              {isRegistering ? "Register" : "Login"}
            </button>

            <p onClick={toggleForm} className="toggle-form">
              {isRegistering ? "Already have an account? Login" : "Don't have an account? Register"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
