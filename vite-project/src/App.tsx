import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { supabase } from "./lib/supabase";

type User = {
  fullName: string;
  email: string;
  password: string;
  votersId: string;
  address: string;
  phone?: string;
};

type Report = {
  id: string;
  type: string;
  location: string;
  description: string;
  phone: string;
  timestamp: string;
  status: "pending" | "responding" | "resolved";
  reporter_name: string;
  reporter_email: string;
  reporter_voters_id: string;
  reporter_phone?: string;
  photo_url?: string;
  latitude?: number;
  longitude?: number;
  is_emergency?: boolean;
};

type Responder = {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  is_active: boolean;
};

export default function App() {
  // ================= STATE VARIABLES =================
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [showUserReports, setShowUserReports] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  
  // Separate page states
  const [showUserLoginPage, setShowUserLoginPage] = useState(false);
  const [showResponderLoginPage, setShowResponderLoginPage] = useState(false);
  const [showAdminLoginPage, setShowAdminLoginPage] = useState(false);
  
  // Responder states
  const [isResponder, setIsResponder] = useState(false);
  const [responderData, setResponderData] = useState<Responder | null>(null);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [newResponder, setNewResponder] = useState({ name: "", email: "", password: "", phone: "" });
  const [responderLogin, setResponderLogin] = useState({ email: "", password: "" });
  
  // Camera & GPS
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [usingBackCamera, setUsingBackCamera] = useState(true);
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);
  const autoCaptureTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Tracking
  const [trackingId, setTrackingId] = useState("");
  const [trackedReport, setTrackedReport] = useState<Report | null>(null);
  const [trackingError, setTrackingError] = useState("");
  
  // Emergency form
  const [emergencyReport, setEmergencyReport] = useState({
    type: "",
    location: "",
    description: "",
    reporter_name: "",
    reporter_contact: "",
  });
  
  // 911 Modal state
  const [show911Modal, setShow911Modal] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    votersId: "",
    address: "",
    phone: "",
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

  // Incident types list
  const incidentTypes = [
    "Fire",
    "Medical Emergency",
    "Accident",
    "Flood",
    "Power Outage",
    "Structural Damage",
    "Animal Rescue",
    "Security Incident"
  ];

  // Emergency incident types
  const emergencyTypes = [
    "Fire",
    "Medical Emergency",
    "Serious Accident",
    "Flood",
    "Power Outage",
    "Building Collapse",
    "Crime in Progress"
  ];

  // ================= SMS FUNCTIONS =================
  const sendSMS = (phoneNumber: string, message: string) => {
    if (!phoneNumber || phoneNumber.length < 10) {
      console.log("Invalid phone number");
      return false;
    }
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const smsUrl = `sms:${cleanNumber}?body=${encodeURIComponent(message)}`;
    window.location.href = smsUrl;
    return true;
  };

  const sendEmergencyAlertSMS = async (report: any) => {
    const activeResponders = responders.filter(r => r.is_active && r.phone);
    const message = `EMERGENCY ALERT: ${report.type} at ${report.location}. Description: ${report.description.substring(0, 100)}. Tracking ID: ${report.id}`;
    
    for (const responder of activeResponders) {
      if (responder.phone) {
        const confirmSend = window.confirm(`Send SMS alert to ${responder.name} (${responder.phone})?`);
        if (confirmSend) {
          sendSMS(responder.phone, message);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  };

  const sendStatusUpdateSMS = (report: Report, newStatus: string) => {
    if (report.reporter_phone) {
      const statusMessages = {
        pending: `Your report ${report.id} has been received and is pending review.`,
        responding: `URGENT: Responders are on their way to your location for report ${report.id}.`,
        resolved: `Your report ${report.id} has been resolved. Thank you for your cooperation.`
      };
      const message = statusMessages[newStatus as keyof typeof statusMessages] || `Status updated to ${newStatus} for report ${report.id}`;
      
      const confirmSend = window.confirm(`Send SMS update to ${report.reporter_name} (${report.reporter_phone})?`);
      if (confirmSend) {
        sendSMS(report.reporter_phone, message);
      }
    }
  };

  // ================= 911 CALL FUNCTION =================
  const call911 = () => {
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.href = "tel:911";
      return;
    }
    setShow911Modal(true);
  };

  const close911Modal = () => {
    setShow911Modal(false);
  };

  const copy911Number = () => {
    navigator.clipboard.writeText("911");
    alert("911 has been copied to your clipboard. Please dial it immediately from your phone.");
  };

  // ================= AUTO-CAPTURE CLEANUP =================
  const clearAutoCapture = () => {
    if (autoCaptureTimerRef.current) {
      clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }
    setAutoCaptureCountdown(null);
  };

  // ================= FETCH FUNCTIONS =================
  const fetchReports = async () => {
    let query = supabase.from("reports").select("*").order("timestamp", { ascending: false });
    if (isResponder) {
      query = query.in("status", ["pending", "responding"]);
    }
    const { data } = await query;
    if (data) setReports(data);
  };

  const fetchUserReports = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("reporter_email", user.email)
      .order("timestamp", { ascending: false });
    if (data) setReports(data);
  };

  const fetchResponders = async () => {
    const { data } = await supabase.from("responders").select("*").order("name");
    if (data) setResponders(data);
  };

  useEffect(() => {
    fetchReports();
  }, [isResponder]);

  useEffect(() => {
    if (isAdmin) fetchResponders();
  }, [isAdmin]);

  useEffect(() => {
    if (!isResponder) return;
    const subscription = supabase
      .channel('all-reports')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'reports' }, 
        (payload) => {
          setSuccess(`NEW REPORT: ${payload.new.type} at ${payload.new.location}`);
          autoClearMessages();
          fetchReports();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [isResponder]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const autoClearMessages = () => {
    setTimeout(() => {
      setError("");
      setSuccess("");
    }, 3000);
  };

  // ================= TRACK, EXPORT, GPS, CAMERA =================
  const handleTrackReport = async () => {
    if (!trackingId.trim()) {
      setTrackingError("Please enter a tracking ID");
      return;
    }
    setTrackingError("");
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", trackingId.toUpperCase())
      .single();
    if (error || !data) {
      setTrackingError("Report not found. Please check your tracking ID.");
      setTrackedReport(null);
    } else {
      setTrackedReport(data);
    }
  };

  const exportToCSV = () => {
    const headers = ["ID", "Type", "Location", "Description", "Status", "Date", "Reporter Name", "Reporter Email", "Voter's ID", "Phone", "Latitude", "Longitude"];
    const csvData = reports.map(r => [
      r.id, r.type, r.location, r.description, r.status,
      new Date(r.timestamp).toLocaleString(), r.reporter_name, r.reporter_email, r.reporter_voters_id,
      r.reporter_phone || "", r.latitude || "", r.longitude || ""
    ]);
    const csvContent = [headers, ...csvData].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess("Reports exported to CSV successfully!");
    autoClearMessages();
  };

  const getCurrentLocation = (isEmergency: boolean = false) => {
    setLocationStatus("Getting your location...");
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setLocationStatus("");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude, address: "" });
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const address = data.display_name || `${latitude}, ${longitude}`;
          setUserLocation({ lat: latitude, lng: longitude, address });
          setLocationStatus("Location captured successfully!");
          if (isEmergency) {
            setEmergencyReport(prev => ({ ...prev, location: address }));
          } else {
            setReportData(prev => ({ ...prev, location: address }));
          }
          setTimeout(() => setLocationStatus(""), 3000);
        } catch (err) {
          setUserLocation({ lat: latitude, lng: longitude, address: `${latitude}, ${longitude}` });
          if (isEmergency) {
            setEmergencyReport(prev => ({ ...prev, location: `${latitude}, ${longitude}` }));
          } else {
            setReportData(prev => ({ ...prev, location: `${latitude}, ${longitude}` }));
          }
          setLocationStatus("Location captured!");
          setTimeout(() => setLocationStatus(""), 3000);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setError("Failed to get location. Please enter manually.");
        setLocationStatus("");
        autoClearMessages();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const startCamera = async () => {
    setShowCamera(true);
    clearAutoCapture();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: usingBackCamera ? "environment" : "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setAutoCaptureCountdown(2);
          autoCaptureTimerRef.current = setTimeout(() => {
            if (videoRef.current && streamRef.current && !capturedPhoto && showCamera) {
              capturePhoto();
            }
            setAutoCaptureCountdown(null);
            autoCaptureTimerRef.current = null;
          }, 2000);
        };
      }
    } catch (err) {
      setError("Unable to access camera. Please allow camera permissions.");
      setShowCamera(false);
      autoClearMessages();
    }
  };

  const switchCamera = () => {
    setUsingBackCamera(!usingBackCamera);
    stopCamera();
    startCamera();
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const photoData = canvasRef.current.toDataURL('image/jpeg', 0.7);
        setCapturedPhoto(photoData);
        stopCamera();
        setShowCamera(false);
        clearAutoCapture();
      }
    }
  };

  const stopCamera = () => {
    clearAutoCapture();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!capturedPhoto) return null;
    setUploading(true);
    try {
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const fileName = `${timestamp}_${randomString}.jpg`;
      const { error: uploadError } = await supabase.storage.from('reports').upload(fileName, blob, { contentType: 'image/jpeg', cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('reports').getPublicUrl(fileName);
      return publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  // ================= SUBMIT HANDLERS =================
  const handleEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!emergencyReport.type || !emergencyReport.location || !emergencyReport.description) {
      setError("Please fill all required fields");
      autoClearMessages();
      return;
    }
    setUploading(true);
    try {
      let photoUrl = null;
      if (capturedPhoto) photoUrl = await uploadPhoto();
      const reportId = "EMG-" + Math.random().toString(36).substr(2, 8).toUpperCase();
      const reportToInsert = {
        id: reportId,
        type: `EMERGENCY: ${emergencyReport.type}`,
        location: emergencyReport.location,
        description: emergencyReport.description,
        status: "responding",
        reporter_name: emergencyReport.reporter_name || "Anonymous",
        reporter_email: emergencyReport.reporter_contact || "emergency@report.com",
        reporter_voters_id: "EMERGENCY",
        reporter_phone: emergencyReport.reporter_contact || "",
        photo_url: photoUrl,
        latitude: userLocation?.lat || null,
        longitude: userLocation?.lng || null,
      };
      const { error } = await supabase.from("reports").insert([reportToInsert]);
      if (error) throw error;
      setSuccess(`EMERGENCY REPORT SENT! Your tracking ID: ${reportId}. Please save this for follow-up.`);
      
      await sendEmergencyAlertSMS(reportToInsert);
      
      autoClearMessages();
      setEmergencyReport({ type: "", location: "", description: "", reporter_name: "", reporter_contact: "" });
      setCapturedPhoto(null);
      setUserLocation(null);
      setShowEmergencyForm(false);
      setShowHome(true);
      fetchReports();
      setTimeout(() => setSuccess(""), 8000);
    } catch (err) {
      console.error(err);
      setError("Failed to submit emergency report");
      autoClearMessages();
    } finally {
      setUploading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    const votersIdRegex = /^[A-Z0-9]{8,12}$/i;
    if (!votersIdRegex.test(form.votersId)) {
      setError("Please enter a valid Voter's ID (8-12 alphanumeric characters)");
      autoClearMessages();
      return;
    }
    const { data: existingUser } = await supabase.from("users").select("voters_id").eq("voters_id", form.votersId).single();
    if (existingUser) {
      setError("This Voter's ID is already registered");
      autoClearMessages();
      return;
    }
    const { error } = await supabase.from("users").insert([{
      full_name: form.fullName, email: form.email, password: form.password, voters_id: form.votersId, address: form.address, phone: form.phone
    }]);
    if (error) {
      setError(error.message);
      autoClearMessages();
    } else {
      setSuccess("Account created! Please login.");
      autoClearMessages();
      setShowLogin(true);
      setShowUserLoginPage(false);
      setShowHome(false);
      setForm({ fullName: "", email: "", password: "", votersId: "", address: "", phone: "" });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    const { data, error } = await supabase.from("users").select("*").eq("email", login.email).eq("password", login.password).single();
    if (error || !data) {
      setError("Invalid credentials");
      autoClearMessages();
      return;
    }
    setUser({
      fullName: data.full_name, email: data.email, password: data.password, votersId: data.voters_id, address: data.address, phone: data.phone
    });
    setIsLoggedIn(true);
    setShowUserLoginPage(false);
    setShowHome(false);
    clearMessages();
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (adminLogin.username === "admin" && adminLogin.password === "admin123") {
      setIsAdmin(true);
      setShowAdminLoginPage(false);
      setShowAdminPanel(false);
      setShowHome(false);
      clearMessages();
    } else {
      setError("Invalid admin login");
      autoClearMessages();
    }
  };

  const handleResponderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    const { data, error } = await supabase.from("responders").select("*").eq("email", responderLogin.email).eq("password", responderLogin.password).single();
    if (error || !data) {
      setError("Invalid responder credentials");
      autoClearMessages();
      return;
    }
    if (!data.is_active) {
      setError("Your account is inactive. Contact admin.");
      return;
    }
    setResponderData(data);
    setIsResponder(true);
    setShowResponderLoginPage(false);
    setShowHome(false);
    clearMessages();
    fetchReports();
  };

  const addResponder = async () => {
    if (!newResponder.name || !newResponder.email || !newResponder.password) {
      setError("Please fill name, email and password");
      return;
    }
    const { error } = await supabase.from("responders").insert([{ ...newResponder, is_active: true }]);
    if (error) {
      setError(error.message);
    } else {
      setSuccess("Responder added successfully");
      setNewResponder({ name: "", email: "", password: "", phone: "" });
      fetchResponders();
    }
    autoClearMessages();
  };

  const deleteResponder = async (id: string) => {
    if (window.confirm("Delete this responder?")) {
      const { error } = await supabase.from("responders").delete().eq("id", id);
      if (error) setError(error.message);
      else {
        setSuccess("Responder deleted");
        fetchResponders();
      }
      autoClearMessages();
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!user) { setError("Please login again"); autoClearMessages(); return; }
    if (!capturedPhoto) { setError("Please take a photo first"); autoClearMessages(); return; }
    if (!reportData.type || !reportData.location || !reportData.description) {
      setError("Please fill all fields");
      autoClearMessages();
      return;
    }
    setUploading(true);
    try {
      let photoUrl = await uploadPhoto();
      const reportId = "RPT-" + Math.random().toString(36).substr(2, 8).toUpperCase();
      const reportToInsert = {
        id: reportId, type: reportData.type, location: reportData.location, description: reportData.description,
        status: "pending", reporter_name: user.fullName, reporter_email: user.email, reporter_voters_id: user.votersId,
        reporter_phone: user.phone || "",
        photo_url: photoUrl, latitude: userLocation?.lat || null, longitude: userLocation?.lng || null,
      };
      const { error } = await supabase.from("reports").insert([reportToInsert]);
      if (error) throw error;
      setSuccess(`Report submitted successfully! Your tracking ID: ${reportId}. Save this to check status later.`);
      autoClearMessages();
      setReportData({ type: "", location: "", description: "" });
      setCapturedPhoto(null);
      setUserLocation(null);
      fetchReports();
    } catch (err) {
      console.error(err);
      setError("Failed to submit report");
      autoClearMessages();
    } finally {
      setUploading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("reports").update({ status }).eq("id", id);
    fetchReports();
    setSuccess(`Report ${id} status updated to ${status}`);
    
    const report = reports.find(r => r.id === id);
    if (report) {
      sendStatusUpdateSMS(report, status);
    }
    
    autoClearMessages();
  };

  const deleteReport = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this report?")) {
      const { error } = await supabase.from("reports").delete().eq("id", id);
      if (error) setError(error.message);
      else setSuccess("Report deleted successfully!");
      fetchReports();
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const sendMessageToAll = async () => {
  if (!smsMessage.trim()) {
    alert("Message is required");
    return;
  }

  try {
    console.log("Starting SMS sending...");

    for (const r of reports) {
      if (!r.reporter_phone) {
        console.log("Skipped no phone:", r.id);
        continue;
      }

      const payload = {
        content: smsMessage,
        from: "639758489896",
        to: r.reporter_phone,
      };

      console.log("Sending to:", r.reporter_phone);
      console.log("Payload:", payload);

      const response = await fetch(
        "https://api.httpsms.com/v1/messages/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key":
              "uk_pxjUQdA2ne9AfETkz8_vFQ96a0TCtYYRt-3SEVBXyo2raoNOrJLdlUx_rZDpjvZt",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      console.log("Response:", data);

      if (!response.ok) {
        alert(`Failed to send SMS to ${r.reporter_phone}`);
        continue;
      }

      console.log(`SMS sent to ${r.reporter_phone}`);
    }

    alert("Messages sent successfully!");
    setShowSMSModal(false);
    setSmsMessage("");
  } catch (error) {
    console.error(error);
    alert("Something went wrong");
  }
};

  // ================= RENDER PAGES =================

  // 911 Modal for Desktop
  const render911Modal = () => {
    if (!show911Modal) return null;
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(5px)'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '24px',
          padding: '30px',
          maxWidth: '450px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🚨</div>
          <h2 style={{ color: '#dc2626', fontSize: '1.8rem', marginBottom: '20px', fontWeight: 'bold' }}>EMERGENCY ACTION NEEDED</h2>
          <p style={{ fontSize: '1.2rem', marginBottom: '20px', color: '#333' }}>
            Please call <strong style={{ fontSize: '1.5rem' }}>911</strong> immediately from your phone.
          </p>
          <div style={{ backgroundColor: '#fee2e2', padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#dc2626', letterSpacing: '5px', marginBottom: '10px' }}>911</div>
            <p style={{ fontSize: '1rem', color: '#666' }}>Dial this number right now</p>
          </div>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button onClick={copy911Number} style={{ padding: '12px 24px', backgroundColor: '#065f46', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}>Copy 911</button>
            <button onClick={close911Modal} style={{ padding: '12px 24px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  // Resident Portal (User Login/Signup)
  if (showUserLoginPage) {
    return (
      <>
        <div className="backgroundOverlay"></div>
        <div className="container">
          <div className="card">
            <div className="header">
              <div className="logoContainer">
                <img src="/image.png" alt="Barangay Logo" className="imageLogo" />
                <div className="logoDivider"></div>
              </div>
              <h1 className="barangayTitle">Barangay</h1>
              <h1 className="giligaonTitle">Giligaon</h1>
              <p className="subtitle">Community Incident Reporting System</p>
            </div>
            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}
            {!showLogin ? (
              <div className="authForm">
                <h3>Create Account</h3>
                <form onSubmit={handleSignup}>
                  <div className="formGroup"><label>Full Name</label><input type="text" placeholder="Juan Dela Cruz" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
                  <div className="formGroup"><label>Email</label><input type="email" placeholder="juan@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                  <div className="formGroup"><label>Voter's ID</label><input type="text" placeholder="Enter Voter's ID" value={form.votersId} onChange={(e) => setForm({ ...form, votersId: e.target.value.toUpperCase() })} required /></div>
                  <div className="formGroup"><label>Address</label><input type="text" placeholder="Enter your address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required /></div>
                  <div className="formGroup"><label>Phone Number (for SMS alerts)</label><input type="tel" placeholder="09XXXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="formGroup"><label>Password</label><input type="password" placeholder="Create password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
                  <button type="submit" className="submitBtn">Create Account</button>
                  <div className="toggleAuth"><p>Already have an account? <span onClick={() => { clearMessages(); setShowLogin(true); }}>Login here</span></p></div>
                </form>
              </div>
            ) : (
              <div className="authForm">
                <h3>Welcome Back</h3>
                <form onSubmit={handleLogin}>
                  <div className="formGroup"><label>Email</label><input type="email" placeholder="juan@example.com" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} required /></div>
                  <div className="formGroup"><label>Password</label><input type="password" placeholder="Enter password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} required /></div>
                  <button type="submit" className="submitBtn">Login</button>
                  <div className="toggleAuth"><p>Don't have an account? <span onClick={() => { clearMessages(); setShowLogin(false); }}>Sign up</span></p></div>
                </form>
              </div>
            )}
            <button className="backToHomeBtn" onClick={() => { setShowUserLoginPage(false); setShowHome(true); clearMessages(); setShowLogin(false); }}>Back to Home</button>
          </div>
        </div>
      </>
    );
  }

  // Responder Login Page
  if (showResponderLoginPage) {
    return (
      <>
        <div className="backgroundOverlay"></div>
        <div className="container">
          <div className="card responderCard">
            <div className="header">
              <h1 className="title">Responder Portal</h1>
              <p className="subtitle">Emergency Response Team</p>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="authForm">
              <form onSubmit={handleResponderLogin}>
                <div className="formGroup"><label>Email</label><input type="email" placeholder="responder@barangay.gov.ph" value={responderLogin.email} onChange={(e) => setResponderLogin({ ...responderLogin, email: e.target.value })} required /></div>
                <div className="formGroup"><label>Password</label><input type="password" placeholder="Enter your responder password" value={responderLogin.password} onChange={(e) => setResponderLogin({ ...responderLogin, password: e.target.value })} required /></div>
                <button type="submit" className="responderLoginBtn">Login as Responder</button>
              </form>
            </div>
            <button className="backToHomeBtn" onClick={() => { setShowResponderLoginPage(false); setShowHome(true); clearMessages(); }}>Back to Home</button>
          </div>
        </div>
      </>
    );
  }

  // Admin Login Page
  if (showAdminLoginPage) {
    return (
      <>
        <div className="backgroundOverlay"></div>
        <div className="container">
          <div className="card adminCard">
            <div className="header">
              <h1 className="title">Admin Portal</h1>
              <p className="subtitle">Barangay Administration</p>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="authForm">
              <form onSubmit={handleAdminLogin}>
                <div className="formGroup"><label>Username</label><input type="text" placeholder="admin" value={adminLogin.username} onChange={(e) => setAdminLogin({ ...adminLogin, username: e.target.value })} required /></div>
                <div className="formGroup"><label>Password</label><input type="password" placeholder="Enter admin password" value={adminLogin.password} onChange={(e) => setAdminLogin({ ...adminLogin, password: e.target.value })} required /></div>
                <button type="submit" className="adminLoginBtn">Login as Admin</button>
              </form>
            </div>
            <button className="backToHomeBtn" onClick={() => { setShowAdminLoginPage(false); setShowHome(true); clearMessages(); }}>Back to Home</button>
          </div>
        </div>
      </>
    );
  }

  // Tracking Page
  if (showTracking) {
    return (
      <>
        <div className="backgroundOverlay"></div>
        <div className="trackingContainer">
          <div className="trackingCard">
            <div className="trackingHeader">
              <h1>Track Your Report</h1>
              <p>Enter your tracking ID to check the status</p>
            </div>
            <div className="trackingContent">
              {trackingError && <div className="error">{trackingError}</div>}
              <div className="trackingInputGroup">
                <input type="text" className="trackingInput" placeholder="Enter Tracking ID (e.g., RPT-ABC123 or EMG-XYZ789)" value={trackingId} onChange={(e) => setTrackingId(e.target.value.toUpperCase())} />
                <button className="trackingBtn" onClick={handleTrackReport}>Track Report</button>
              </div>
              {trackedReport && (
                <div className="trackingResult">
                  <h3>Report Details</h3>
                  <div className="trackingDetails">
                    <div className="trackingRow"><span className="trackingLabel">Tracking ID:</span><span className="trackingValue">{trackedReport.id}</span></div>
                    <div className="trackingRow"><span className="trackingLabel">Status:</span><span className={`trackingStatus ${trackedReport.status}`}>{trackedReport.status.charAt(0).toUpperCase() + trackedReport.status.slice(1)}</span></div>
                    <div className="trackingRow"><span className="trackingLabel">Type:</span><span className="trackingValue">{trackedReport.type}</span></div>
                    <div className="trackingRow"><span className="trackingLabel">Location:</span><span className="trackingValue">{trackedReport.location}</span></div>
                    <div className="trackingRow"><span className="trackingLabel">Description:</span><span className="trackingValue">{trackedReport.description}</span></div>
                    <div className="trackingRow"><span className="trackingLabel">Reported On:</span><span className="trackingValue">{new Date(trackedReport.timestamp).toLocaleString()}</span></div>
                    {trackedReport.latitude && trackedReport.longitude && (
                      <div className="trackingRow"><span className="trackingLabel">Location Map:</span><a href={`https://www.google.com/maps?q=${trackedReport.latitude},${trackedReport.longitude}`} target="_blank" className="trackingMapLink">View on Google Maps</a></div>
                    )}
                  </div>
                </div>
              )}
              <button className="backToHomeBtn" onClick={() => { setShowTracking(false); setShowHome(true); setTrackedReport(null); setTrackingId(""); setTrackingError(""); }}>Back to Home</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Emergency Form Page
  if (showEmergencyForm) {
    return (
      <>
        <div className="backgroundOverlay"></div>
        <div className="emergencyContainer" style={{ overflowY: 'auto', padding: '20px', alignItems: 'flex-start', minHeight: '100vh' }}>
          <div className="emergencyOverlay" style={{ position: 'fixed' }}></div>
          <div className="emergencyCard" style={{ margin: '20px auto', maxWidth: '800px', width: '100%', position: 'relative', zIndex: 1, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div className="emergencyHeader" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <h1>EMERGENCY REPORT</h1>
              <p>Immediate response will be dispatched</p>
            </div>
            <div style={{ background: '#dc2626', color: 'white', padding: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', position: 'sticky', top: '120px', zIndex: 1 }}>
              IMPORTANT: This emergency reporting service is for Barangay Giligaon residents only. If you are not a resident, please call 911 immediately.
            </div>
            <div className="emergencyContent" style={{ flex: 1, overflowY: 'auto' }}>
              {error && <div className="error">{error}</div>}
              {success && <div className="success emergencySuccess">{success}</div>}
              {locationStatus && <div className="info">{locationStatus}</div>}
              <form onSubmit={handleEmergencySubmit}>
                <div className="formGroup">
                  <label>Incident Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginTop: '10px' }}>
                    {emergencyTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setEmergencyReport({ ...emergencyReport, type })}
                        style={{
                          padding: '14px',
                          backgroundColor: emergencyReport.type === type ? '#dc2626' : '#f1f5f9',
                          color: emergencyReport.type === type ? 'white' : '#1e293b',
                          border: emergencyReport.type === type ? '2px solid #dc2626' : '1px solid #cbd5e1',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          fontWeight: '600',
                          transition: 'all 0.3s ease',
                          textAlign: 'center'
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="formGroup">
                  <label>Location</label>
                  <input className="reportInput" placeholder="Enter exact location" value={emergencyReport.location} onChange={(e) => setEmergencyReport({ ...emergencyReport, location: e.target.value })} required />
                  <button type="button" className="locationBtn emergencyLocationBtn" onClick={() => getCurrentLocation(true)}>Get My Current Location</button>
                </div>
                <div className="formGroup">
                  <label>Take Photo (Optional but recommended)</label>
                  <div className="cameraSection">
                    {!showCamera && !capturedPhoto && <button type="button" className="cameraBtn emergencyCameraBtn" onClick={startCamera}>Open Camera</button>}
                    {showCamera && (
                      <div className="cameraContainer">
                        <video ref={videoRef} autoPlay playsInline className="cameraPreview" />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        {autoCaptureCountdown !== null && (
                          <div style={{ textAlign: 'center', marginTop: '8px', color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '4px', borderRadius: '8px' }}>
                            Auto-capturing in {autoCaptureCountdown} second{autoCaptureCountdown !== 1 ? 's' : ''}...
                          </div>
                        )}
                        <div className="cameraButtons">
                          <button type="button" className="captureBtn" onClick={capturePhoto}>Capture</button>
                          <button type="button" className="switchCameraBtn" onClick={switchCamera}>Switch Camera</button>
                          <button type="button" className="cancelBtn" onClick={() => { stopCamera(); setShowCamera(false); clearAutoCapture(); }}>Cancel</button>
                        </div>
                      </div>
                    )}
                    {capturedPhoto && (
                      <div className="photoPreview">
                        <img src={capturedPhoto} alt="Evidence" className="previewImage" />
                        <button type="button" className="retakeBtn" onClick={retakePhoto}>Retake</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="formGroup">
                  <label>Description of Emergency</label>
                  <textarea className="textarea" placeholder="Describe what is happening..." value={emergencyReport.description} onChange={(e) => setEmergencyReport({ ...emergencyReport, description: e.target.value })} required />
                </div>
                <div className="formRow">
                  <div className="formGroup"><label>Your Name (Optional)</label><input type="text" placeholder="Enter your name" value={emergencyReport.reporter_name} onChange={(e) => setEmergencyReport({ ...emergencyReport, reporter_name: e.target.value })} /></div>
                  <div className="formGroup"><label>Contact Number (for SMS updates)</label><input type="tel" placeholder="09XXXXXXXXX" value={emergencyReport.reporter_contact} onChange={(e) => setEmergencyReport({ ...emergencyReport, reporter_contact: e.target.value })} /></div>
                </div>
                <button type="submit" className="emergencySubmitBtn" disabled={uploading}>{uploading ? "Sending Emergency Report..." : "SEND EMERGENCY REPORT"}</button>
                <button type="button" className="backToHomeBtn" onClick={() => { setShowEmergencyForm(false); setShowHome(true); setCapturedPhoto(null); clearMessages(); stopCamera(); clearAutoCapture(); }}>Back to Home</button>
              </form>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Home Page
  if (showHome) {
    return (
      <>
        <div className="backgroundOverlay"></div>
        <div className="homeContainer">
          <div className="homeOverlay"></div>
          <div className="homeContent">
            <div className="homeLogoContainer"><img src="/image.png" alt="Barangay Logo" className="homeLogo" /></div>
            <h1 className="homeTitle">Barangay Giligaon</h1>
            <p className="homeSubtitle">Community Incident Reporting System</p>
            <button className="emergencyHomeBtn" onClick={() => setShowEmergencyForm(true)}>INCASE OF EMERGENCY</button>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '-20px', marginBottom: '60px' }}>
              <p style={{ fontSize: '1.2rem', opacity: 0.9, margin: 0 }}>For Barangay Giligaon residents only. If you are not from this barangay, call 911 immediately.</p>
              <button onClick={call911} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '40px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>Call 911 Now</button>
            </div>
            <div className="homeFeatures">
              <div className="featureCard emergencyFeature"><h3>Urgent / Emergency</h3><p>For active emergencies requiring immediate response. No login required.</p><button className="featureBtn emergency" onClick={() => setShowEmergencyForm(true)}>Report Emergency</button></div>
              <div className="featureCard"><h3>Community Report</h3><p>For non-urgent incidents. Requires login for verification.</p><button className="featureBtn" onClick={() => setShowUserLoginPage(true)}>Login to Report</button></div>
              <div className="featureCard"><h3>Track Your Report</h3><p>Check the status of your submitted report using your tracking ID.</p><button className="featureBtn" onClick={() => setShowTracking(true)}>Track Report</button></div>
            </div>
            <div className="homeButtons">
              <button className="homeBtn primary" onClick={() => setShowUserLoginPage(true)}>Resident Portal</button>
              <button className="homeBtn secondary" onClick={() => setShowResponderLoginPage(true)}>Responder Portal</button>
              <button className="homeBtn outline" onClick={() => setShowAdminLoginPage(true)}>Admin Portal</button>
            </div>
            <p className="homeFooter">For emergencies, use the red button above. For non-urgent reports, please login.</p>
          </div>
        </div>
        {render911Modal()}
      </>
    );
  }

  // Admin Dashboard
  if (isAdmin) {
    const pendingCount = reports.filter(r => r.status === "pending").length;
    const emergencyCount = reports.filter(r => r.reporter_voters_id === "EMERGENCY").length;
    const respondingCount = reports.filter(r => r.status === "responding").length;
    const resolvedCount = reports.filter(r => r.status === "resolved").length;

    return (
      <>
        <div className="backgroundOverlay"></div>
        <div className="adminContainer">
          <div className="adminHeader">
            <div className="adminHeaderContent">
              <div><h1 className="adminTitle">Barangay Admin Dashboard</h1><p>Manage and respond to incident reports</p></div>
              <div className="adminStats">
                <div className="statBox"><span className="statNumber">{emergencyCount}</span><span className="statLabel">Emergency</span></div>
                <div className="statBox"><span className="statNumber">{reports.length}</span><span className="statLabel">Total</span></div>
                <div className="statBox"><span className="statNumber">{pendingCount}</span><span className="statLabel">Pending</span></div>
                <div className="statBox"><span className="statNumber">{respondingCount}</span><span className="statLabel">Responding</span></div>
                <div className="statBox"><span className="statNumber">{resolvedCount}</span><span className="statLabel">Resolved</span></div>
              </div>
              <button className="adminLogoutBtn" onClick={() => { setIsAdmin(false); setShowHome(true); }}>Logout</button>
            </div>
          </div>
          <div className="adminContent">
            <div className="responderSection">
              <h3>Manage Responders</h3>
              <p style={{ marginBottom: '15px', color: '#64748b', fontSize: '14px' }}>Responder phone numbers are used for SMS alerts when emergencies are reported.</p>
              <div className="addResponderForm">
                <input type="text" placeholder="Name" value={newResponder.name} onChange={e => setNewResponder({...newResponder, name: e.target.value})} />
                <input type="email" placeholder="Email" value={newResponder.email} onChange={e => setNewResponder({...newResponder, email: e.target.value})} />
                <input type="password" placeholder="Password" value={newResponder.password} onChange={e => setNewResponder({...newResponder, password: e.target.value})} />
                <input type="tel" placeholder="Phone Number (for SMS alerts)" value={newResponder.phone} onChange={e => setNewResponder({...newResponder, phone: e.target.value})} />
                <button onClick={addResponder}>Add Responder</button>
              </div>
              <table className="respondersTable">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {responders.map(r => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>{r.email}</td>
                      <td>{r.phone || "—"}</td>
                      <td><span className={r.is_active ? "activeBadge" : "inactiveBadge"}>{r.is_active ? "Active" : "Inactive"}</span></td>
                      <td><button className="deleteBtn" onClick={() => deleteResponder(r.id)} title="Delete">🗑️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="reportsTableContainer">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '15px' }}>
                <h2 style={{ margin: 0 }}>All Incident Reports</h2>
                <button className="exportBtn" onClick={exportToCSV}>Export CSV</button>
               <button
                  className="exportBtn"
                  onClick={() => setShowSMSModal(true)}
                >
                  Send Message
                </button>    
                {showSMSModal && (
                  <div
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      background: "rgba(0,0,0,0.5)",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      zIndex: 9999,
                    }}
                  >
                    <div
                      style={{
                        background: "#fff",
                        padding: "25px",
                        borderRadius: "12px",
                        width: "400px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "15px",
                      }}
                    >
                      <h3 style={{ margin: 0 }}>Send SMS Message</h3>

                      <textarea
                        rows={5}
                        placeholder="Enter message"
                        value={smsMessage}
                        onChange={(e) => setSmsMessage(e.target.value)}
                        style={{
                          padding: "12px",
                          fontSize: "16px",
                          resize: "none",
                        }}
                      />

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "10px",
                        }}
                      >
                        <button
                          onClick={() => setShowSMSModal(false)}
                          className="actionBtn deleteBtn"
                        >
                          Cancel
                        </button>

                        <button
                          onClick={sendMessageToAll}
                          className="actionBtn respondBtn"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}        
                </div>
              {error && <div className="error">{error}</div>}
              {success && <div className="success">{success}</div>}
              {reports.length === 0 ? (
                <div className="noReports">No reports submitted yet.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="reportsTable">
                    <thead>
                      <tr><th>ID</th><th>Type</th><th>Location</th><th>Reporter</th><th>Status</th><th>Photo</th><th>GPS</th><th>Actions</th><th>Delete</th></tr>
                    </thead>
                    <tbody>
                      {reports.map((r) => (
                        <tr key={r.id} className={`reportRow ${r.reporter_voters_id === "EMERGENCY" ? "emergencyRow" : ""}`}>
                          <td className="reportId">{r.id}</td>
                          <td className={r.reporter_voters_id === "EMERGENCY" ? "emergencyType" : ""}>{r.type}</td>
                          <td>{r.location}</td>
                          <td>{r.reporter_phone}</td>
                          <td>{r.reporter_name} {r.reporter_voters_id === "EMERGENCY" && <span className="emergencyBadge">EMERGENCY</span>}</td>
                          <td><span className={`statusBadge ${r.status}`}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></td>
                          <td>{r.photo_url ? <a href={r.photo_url} target="_blank" rel="noopener noreferrer"><img src={r.photo_url} alt="Evidence" className="thumbnailImage" /></a> : "No photo"}</td>
                          <td>{r.latitude && r.longitude ? <a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank" className="mapLink">View Map</a> : "No GPS"}</td>
                          <td>
                            {r.status !== "responding" && <button className="actionBtn respondBtn" onClick={() => updateStatus(r.id, "responding")}>Respond</button>}
                            {r.status !== "resolved" && <button className="actionBtn resolveBtn" onClick={() => updateStatus(r.id, "resolved")}>Resolve</button>}
                          </td>
                          <td><button className="actionBtn deleteBtn" onClick={() => deleteReport(r.id)} title="Delete">🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // Responder Dashboard
  if (isResponder && responderData) {
    const activeReports = reports.filter(r => r.status !== "resolved");
    return (
      <>
        <div className="backgroundOverlay"></div>
        <div className="responderContainer">
          <div className="responderHeader">
            <h1>Responder Dashboard</h1>
            <p>Welcome, {responderData.name} – you see all active user reports.</p>
            <button className="logoutBtn" onClick={() => { setIsResponder(false); setResponderData(null); setShowHome(true); }}>Logout</button>
          </div>
          <div className="responderContent">
            <h2>Active Reports</h2>
            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}
            {activeReports.length === 0 ? (
              <div className="noReports">No active reports at the moment.</div>
            ) : (
              <div className="emergencyReportsList">
                {activeReports.map(r => (
                  <div key={r.id} className="emergencyCard">
                    <div className="emergencyCardHeader">
                      <span className="emergencyId">{r.id}</span>
                      <span className={`statusBadge ${r.status}`}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
                      {r.reporter_voters_id === "EMERGENCY" && <span className="emergencyBadge">EMERGENCY</span>}
                    </div>
                    <div className="emergencyCardBody">
                      <p><strong>Type:</strong> {r.type}</p>
                      <p><strong>Location:</strong> {r.location}</p>
                      <p><strong>Description:</strong> {r.description}</p>
                      <p><strong>Reported by:</strong> {r.reporter_name} ({r.reporter_email})</p>
                      {r.reporter_phone && <p><strong>Contact:</strong> {r.reporter_phone}</p>}
                      {r.photo_url && <a href={r.photo_url} target="_blank">View Photo</a>}
                      {r.latitude && r.longitude && <a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank">View Map</a>}
                      <div className="actionButtons">
                        {r.status !== "responding" && <button className="respondBtn" onClick={() => updateStatus(r.id, "responding")}>Responding</button>}
                        {r.status !== "resolved" && <button className="resolveBtn" onClick={() => updateStatus(r.id, "resolved")}>Resolve</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // User Dashboard
  if (isLoggedIn && user) {
    if (showUserReports) {
      const userReports = reports.filter(r => r.reporter_email === user.email);
      return (
        <>
          <div className="backgroundOverlay"></div>
          <div className="reportsContainer">
            <div className="reportsCard">
              <div className="reportsHeader">
                <h2>My Reports</h2>
                <p>Track all your submitted incident reports</p>
                <button className="backToReportBtn" onClick={() => { setShowUserReports(false); fetchReports(); }}>Back to New Report</button>
              </div>
              <div className="reportsContent">
                {error && <div className="error">{error}</div>}{success && <div className="success">{success}</div>}
                {userReports.length === 0 ? <div className="noReports">You haven't submitted any reports yet.</div> : (
                  <div className="userReportsList">
                    {userReports.map((report) => (
                      <div key={report.id} className="userReportCard">
                        <div className="userReportHeader"><span className="userReportId">{report.id}</span><span className={`statusBadge ${report.status}`}>{report.status.charAt(0).toUpperCase() + report.status.slice(1)}</span></div>
                        <div className="userReportBody">
                          <div className="userReportRow"><strong>Type:</strong> {report.type}</div>
                          <div className="userReportRow"><strong>Location:</strong> {report.location}</div>
                          <div className="userReportRow"><strong>Description:</strong> {report.description}</div>
                          <div className="userReportRow"><strong>Date Submitted:</strong> {new Date(report.timestamp).toLocaleString()}</div>
                          {report.photo_url && <div className="userReportRow"><strong>Photo:</strong> <a href={report.photo_url} target="_blank" className="viewPhotoLink">View Photo</a></div>}
                          {report.latitude && report.longitude && <div className="userReportRow"><strong>Location Map:</strong> <a href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`} target="_blank" className="mapLink">View on Map</a></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <div className="backgroundOverlay"></div>
        <div className="reportContainer">
          <div className="reportCard">
            <div className="reportHeader">
              <div><h2>New Incident Report</h2><p className="reportSubtitle">Welcome, {user.fullName}</p><p className="votersIdBadge">Voter's ID: {user.votersId}</p></div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button className="myReportsBtn" onClick={() => { setShowUserReports(true); fetchUserReports(); }}>My Reports</button>
                <button className="topLogoutBtn" onClick={() => { setIsLoggedIn(false); setShowHome(true); }}>Logout</button>
              </div>
            </div>
            <div className="reportContent">
              {error && <div className="error">{error}</div>}{success && <div className="success">{success}</div>}{locationStatus && <div className="info">{locationStatus}</div>}
              <form onSubmit={handleSubmitReport}>
                <div className="formGroup">
                  <label>Incident Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginTop: '10px' }}>
                    {incidentTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setReportData({ ...reportData, type })}
                        style={{
                          padding: '14px',
                          backgroundColor: reportData.type === type ? '#0F766E' : '#f1f5f9',
                          color: reportData.type === type ? 'white' : '#1e293b',
                          border: reportData.type === type ? '2px solid #0F766E' : '1px solid #cbd5e1',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          fontWeight: '600',
                          transition: 'all 0.3s ease',
                          textAlign: 'center'
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="formGroup">
                  <label>Location</label>
                  <input className="reportInput" placeholder="Enter exact location or address" value={reportData.location} onChange={(e) => setReportData({ ...reportData, location: e.target.value })} required />
                  <button type="button" className="locationBtn" onClick={() => getCurrentLocation(false)}>Get My Current Location</button>
                  {userLocation && <small style={{ display: 'block', marginTop: '8px', color: '#10b981' }}>Location captured: {userLocation.address.substring(0, 100)}...</small>}
                </div>
                <div className="formGroup">
                  <label>Take Photo (Required for Evidence)</label>
                  <div className="cameraSection">
                    {!showCamera && !capturedPhoto && <button type="button" className="cameraBtn" onClick={startCamera}>Open Camera</button>}
                    {showCamera && (
                      <div className="cameraContainer">
                        <video ref={videoRef} autoPlay playsInline className="cameraPreview" />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        {autoCaptureCountdown !== null && (
                          <div style={{ textAlign: 'center', marginTop: '8px', color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '4px', borderRadius: '8px' }}>
                            Auto-capturing in {autoCaptureCountdown} second{autoCaptureCountdown !== 1 ? 's' : ''}...
                          </div>
                        )}
                        <div className="cameraButtons">
                          <button type="button" className="captureBtn" onClick={capturePhoto}>Capture</button>
                          <button type="button" className="switchCameraBtn" onClick={switchCamera}>Switch Camera</button>
                          <button type="button" className="cancelBtn" onClick={() => { stopCamera(); setShowCamera(false); clearAutoCapture(); }}>Cancel</button>
                        </div>
                      </div>
                    )}
                    {capturedPhoto && (
                      <div className="photoPreview">
                        <img src={capturedPhoto} alt="Evidence" className="previewImage" />
                        <button type="button" className="retakeBtn" onClick={retakePhoto}>Retake</button>
                      </div>
                    )}
                  </div>
                  <small>Photo must be taken live with camera to prevent scams. Camera will auto-capture after 2 seconds.</small>
                </div>
                <div className="formGroup">
                  <label>Description</label>
                  <textarea className="textarea" placeholder="Please provide detailed information about the incident..." value={reportData.description} onChange={(e) => setReportData({ ...reportData, description: e.target.value })} required />
                </div>
                <button type="submit" className="submitBtn" disabled={uploading || !capturedPhoto}>{uploading ? "Uploading..." : "Submit Report"}</button>
              </form>
            </div>
          </div>
        </div>
      </>
    );
  }

  return <>{window.location.href = "/"}</>;
}