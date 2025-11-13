import React, { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "@/components/Login";
import Register from "@/components/Register";
import TeacherDashboard from "@/components/TeacherDashboard";
import StudentDashboard from "@/components/StudentDashboard";
import LandingPage from "@/components/LandingPage";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={!user ? <LandingPage /> : <Navigate to={user.role === "teacher" ? "/teacher" : "/student"} />} />
        <Route path="/login" element={!user ? <Login onLogin={handleLogin} /> : <Navigate to={user.role === "teacher" ? "/teacher" : "/student"} />} />
        <Route path="/register" element={!user ? <Register onLogin={handleLogin} /> : <Navigate to={user.role === "teacher" ? "/teacher" : "/student"} />} />
        <Route 
          path="/teacher" 
          element={user && user.role === "teacher" ? <TeacherDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/student" 
          element={user && user.role === "student" ? <StudentDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;