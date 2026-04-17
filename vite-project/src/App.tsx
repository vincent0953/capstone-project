import React, { useState, useEffect } from "react";
import "./App.css";
import { supabase } from "./lib/supabase";

type User = {
  fullName: string;
  email: string;
  password: string;
  votersId: string;
  address: string;
};

type Report = {
  id: string;
  type: string;
  location: string;
  description: string;
  timestamp: string;
  status: "pending" | "responding" | "resolved";
  reporter_name: string;
  reporter_email: string;
  reporter_voters_id: string;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    votersId: "",
    address: "",
  });

  const [login, setLogin] = useState({
    email: "",
    password: "",
  });

  const [adminLogin, setAdminLogin] = useState({
    username: "",
    password: "",
  });

  const [reportData, setReportData] = useState({
    type: "",
    location: "",
    description: "",
  });

  // ✅ LOAD REPORTS
  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const { data } = await supabase.from("reports").select("*").order("timestamp", { ascending: false });
    if (data) setReports(data);
  };

  // Helper function to clear messages
  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  // Auto clear messages after 3 seconds
  const autoClearMessages = () => {
    setTimeout(() => {
      setError("");
      setSuccess("");
    }, 3000);
  };

  // ✅ SIGNUP with Voter's ID validation
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages(); // Clear previous messages

    // Validate Voter's ID format (example: 8-12 characters alphanumeric)
    const votersIdRegex = /^[A-Z0-9]{8,12}$/i;
    if (!votersIdRegex.test(form.votersId)) {
      setError("Please enter a valid Voter's ID (8-12 alphanumeric characters)");
      autoClearMessages();
      return;
    }

    // Check if Voter's ID already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("voters_id")
      .eq("voters_id", form.votersId)
      .single();

    if (existingUser) {
      setError("This Voter's ID is already registered");
      autoClearMessages();
      return;
    }

    const { error } = await supabase.from("users").insert([
      {
        full_name: form.fullName,
        email: form.email,
        password: form.password,
        voters_id: form.votersId,
        address: form.address,
      },
    ]);

    if (error) {
      setError(error.message);
      autoClearMessages();
    } else {
      setSuccess("Account created! Please login.");
      autoClearMessages();
      setShowLogin(true);
      setForm({ fullName: "", email: "", password: "", votersId: "", address: "" });
    }
  };

  // ✅ LOGIN
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages(); // Clear previous messages (this fixes the issue!)

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", login.email)
      .eq("password", login.password)
      .single();

    if (error || !data) {
      setError("Invalid credentials");
      autoClearMessages();
      return;
    }

    setUser({
      fullName: data.full_name,
      email: data.email,
      password: data.password,
      votersId: data.voters_id,
      address: data.address,
    });

    setIsLoggedIn(true);
    clearMessages(); // Clear messages on successful login
  };

  // ✅ ADMIN LOGIN
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages(); // Clear previous messages

    if (adminLogin.username === "admin" && adminLogin.password === "admin123") {
      setIsAdmin(true);
      setShowAdminPanel(false);
      clearMessages();
    } else {
      setError("Invalid admin login");
      autoClearMessages();
    }
  };

  // ✅ SUBMIT REPORT
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const newReport = {
      id: "RPT-" + Math.random().toString(36).substr(2, 8).toUpperCase(),
      type: reportData.type,
      location: reportData.location,
      description: reportData.description,
      status: "pending",
      reporter_name: user!.fullName,
      reporter_email: user!.email,
      reporter_voters_id: user!.votersId,
    };

    const { error } = await supabase.from("reports").insert([newReport]);

    if (error) {
      setError(error.message);
      autoClearMessages();
    } else {
      setSuccess("Report submitted!");
      autoClearMessages();
      setReportData({ type: "", location: "", description: "" });
      fetchReports();
    }
  };

  // ✅ UPDATE STATUS
  const updateStatus = async (id: string, status: string) => {
    await supabase.from("reports").update({ status }).eq("id", id);
    fetchReports();
  };

  // ✅ DELETE REPORT
  const deleteReport = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this report? This action cannot be undone.")) {
      const { error } = await supabase.from("reports").delete().eq("id", id);
      
      if (error) {
        setError(error.message);
        setTimeout(() => setError(""), 3000);
      } else {
        setSuccess("Report deleted successfully!");
        fetchReports(); // Refresh the list
        setTimeout(() => setSuccess(""), 3000);
      }
    }
  };

  // ================= ADMIN DASHBOARD =================
  if (isAdmin) {
    // Calculate statistics
    const pendingCount = reports.filter(r => r.status === "pending").length;
    const respondingCount = reports.filter(r => r.status === "responding").length;
    const resolvedCount = reports.filter(r => r.status === "resolved").length;

    return (
      <div className="adminContainer">
        <div className="adminHeader">
          <div className="adminHeaderContent">
            <div>
              <h1>📋 Barangay Admin Dashboard</h1>
              <p>Manage and respond to incident reports</p>
            </div>
            <div className="adminStats">
              <div className="statBox">
                <span className="statNumber">{reports.length}</span>
                <span className="statLabel">Total</span>
              </div>
              <div className="statBox">
                <span className="statNumber">{pendingCount}</span>
                <span className="statLabel">Pending</span>
              </div>
              <div className="statBox">
                <span className="statNumber">{respondingCount}</span>
                <span className="statLabel">Responding</span>
              </div>
              <div className="statBox">
                <span className="statNumber">{resolvedCount}</span>
                <span className="statLabel">Resolved</span>
              </div>
            </div>
            <button className="adminLogoutBtn" onClick={() => setIsAdmin(false)}>
              🚪 Logout
            </button>
          </div>
        </div>

        <div className="adminContent">
          <div className="reportsTableContainer">
            <h2>📊 All Incident Reports</h2>
            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}
            {reports.length === 0 ? (
              <div className="noReports">No reports submitted yet.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="reportsTable">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Location</th>
                      <th>Reporter</th>
                      <th>Voter's ID</th>
                      <th>Status</th>
                      <th>Actions</th>
                      <th>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="reportRow">
                        <td className="reportId">{r.id}</td>
                        <td>{r.type}</td>
                        <td>{r.location}</td>
                        <td>{r.reporter_name}</td>
                        <td className="votersIdCell">{r.reporter_voters_id || "N/A"}</td>
                        <td>
                          <span className={`statusBadge ${r.status}`}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                        </td>
                        <td>
                          {r.status !== "responding" && (
                            <button
                              className="actionBtn respondBtn"
                              onClick={() => updateStatus(r.id, "responding")}
                            >
                              Respond
                            </button>
                          )}
                          {r.status !== "resolved" && (
                            <button
                              className="actionBtn resolveBtn"
                              onClick={() => updateStatus(r.id, "resolved")}
                            >
                              Resolve
                            </button>
                          )}
                        </td>
                        <td>
                          <button
                            className="actionBtn deleteBtn"
                            onClick={() => deleteReport(r.id)}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ================= USER PAGE =================
  if (isLoggedIn && user) {
    return (
      <div className="reportContainer">
        <div className="reportCard">
          <div className="reportHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>📝 New Incident Report</h2>
              <p className="reportSubtitle">Welcome, {user.fullName}</p>
              <p className="votersIdBadge">🪪 Voter's ID: {user.votersId}</p>
            </div>
            <button className="topLogoutBtn" onClick={() => setIsLoggedIn(false)}>
              🚪 Logout
            </button>
          </div>

          <div className="reportContent">
            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}

            <form onSubmit={handleSubmitReport}>
              <div className="formGroup">
                <label>📌 Incident Type</label>
                <select
                  className="reportSelect"
                  value={reportData.type}
                  onChange={(e) => setReportData({ ...reportData, type: e.target.value })}
                  required
                >
                  <option value="">Select Incident Type</option>
                  <option>🔥 Fire</option>
                  <option>🚑 Medical Emergency</option>
                  <option>🚗 Accident</option>
                  <option>🌊 Flood</option>
                  <option>⚡ Power Outage</option>
                  <option>🏠 Structural Damage</option>
                  <option>🐍 Animal Rescue</option>
                  <option>👮 Security Incident</option>
                </select>
              </div>

              <div className="formGroup">
                <label>📍 Location</label>
                <input
                  className="reportInput"
                  placeholder="Enter exact location or address"
                  value={reportData.location}
                  onChange={(e) => setReportData({ ...reportData, location: e.target.value })}
                  required
                />
              </div>

              <div className="formGroup">
                <label>📝 Description</label>
                <textarea
                  className="textarea"
                  placeholder="Please provide detailed information about the incident..."
                  value={reportData.description}
                  onChange={(e) => setReportData({ ...reportData, description: e.target.value })}
                  required
                />
              </div>

              <button type="submit" className="submitBtn">
                🚨 Submit Report
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ================= LOGIN / SIGNUP WITH LOGO AND BACKGROUND =================
  return (
    <div className="container">
      {/* Background overlay for better readability */}
      <div className="backgroundOverlay"></div>
      
      <div className="card">
        <div className="header">
          {/* LOGO SECTION */}
          <div className="logoContainer">
            <img 
              src="/image.png" 
              alt="Barangay Giligaon Logo" 
              className="imageLogo"
            />
            <div className="logoDivider"></div>
          </div>  
          
          <h1 className="title">🏘️ Barangay Giligaon System</h1>
          <p className="subtitle">Community Incident Reporting Platform</p>
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {!showAdminPanel ? (
          <>
            {!showLogin ? (
              <div className="authForm">
                <h3>Create Account</h3>
                <p className="formDescription">Sign up to report incidents in your community</p>
                <form onSubmit={handleSignup}>
                  <div className="formGroup">
                    <label>Full Name</label>
                    <input
                      type="text"
                      placeholder="Juan Dela Cruz"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="formGroup">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="juan@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="formGroup">
                    <label>Voter's ID (Required for Barangay Giligson Residents)</label>
                    <input
                      type="text"
                      placeholder="Enter your Voter's ID (e.g., GIL12345678)"
                      value={form.votersId}
                      onChange={(e) => setForm({ ...form, votersId: e.target.value.toUpperCase() })}
                      required
                    />
                    <small style={{ color: '#718096', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                      Must be 8-12 alphanumeric characters
                    </small>
                  </div>

                  <div className="formGroup">
                    <label>Barangay Address</label>
                    <input
                      type="text"
                      placeholder="Enter your complete address in Barangay Giligson"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      required
                    />
                  </div>

                  <div className="formGroup">
                    <label>Password</label>
                    <input
                      type="password"
                      placeholder="Create a password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                  </div>

                  <button type="submit" className="submitBtn">
                    Create Account
                  </button>

                  <div className="toggleAuth">
                    <p>
                      Already have an account?{" "}
                      <span onClick={() => {
                        clearMessages();
                        setShowLogin(true);
                      }}>Login here</span>
                    </p>
                    <p className="adminLink">
                      Are you an admin?{" "}
                      <span onClick={() => {
                        clearMessages();
                        setShowAdminPanel(true);
                      }}>Admin Login</span>
                    </p>
                  </div>
                </form>
              </div>
            ) : (
              <div className="authForm">
                <h3>Welcome Back</h3>
                <p className="formDescription">Login to your account</p>
                <form onSubmit={handleLogin}>
                  <div className="formGroup">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="juan@example.com"
                      value={login.email}
                      onChange={(e) => setLogin({ ...login, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="formGroup">
                    <label>Password</label>
                    <input
                      type="password"
                      placeholder="Enter your password"
                      value={login.password}
                      onChange={(e) => setLogin({ ...login, password: e.target.value })}
                      required
                    />
                  </div>

                  <button type="submit" className="submitBtn">
                    Login
                  </button>

                  <div className="toggleAuth">
                    <p>
                      Don't have an account?{" "}
                      <span onClick={() => {
                        clearMessages();
                        setShowLogin(false);
                      }}>Sign up</span>
                    </p>
                    <p className="adminLink">
                      Are you an admin?{" "}
                      <span onClick={() => {
                        clearMessages();
                        setShowAdminPanel(true);
                      }}>Admin Login</span>
                    </p>
                  </div>
                </form>
              </div>
            )}
          </>
        ) : (
          <div className="authForm">
            <h3>Admin Access</h3>
            <p className="formDescription">Authorized personnel only</p>
            <form onSubmit={handleAdminLogin}>
              <div className="formGroup">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="admin"
                  value={adminLogin.username}
                  onChange={(e) => setAdminLogin({ ...adminLogin, username: e.target.value })}
                  required
                />
              </div>

              <div className="formGroup">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="Enter admin password"
                  value={adminLogin.password}
                  onChange={(e) => setAdminLogin({ ...adminLogin, password: e.target.value })}
                  required
                />
              </div>

              <button type="submit" className="submitBtn">
                Login as Admin
              </button>

              <div className="toggleAuth">
                <p>
                  <span onClick={() => {
                    clearMessages();
                    setShowAdminPanel(false);
                  }}>← Back to User Login</span>
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}