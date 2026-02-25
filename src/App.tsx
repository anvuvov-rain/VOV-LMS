import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import jwt_decode from "jwt-decode";
import { QRCodeCanvas } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Shield, BookOpen, PenTool, BarChart, LogOut, Cpu } from 'lucide-react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "1124228007902-4akrlkt90re0km3iu6ms3glg5d1vee4q.apps.googleusercontent.com";

function App() {
  const [user, setUser] = useState<any>(null);
  const [news, setNews] = useState([]);
  const [qrCode, setQrCode] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [summaryResult, setSummaryResult] = useState('');

  // 1. Tự động lấy tin tức và cập nhật mã QR mỗi 30 giây
  useEffect(() => {
    fetch('/api/news').then(res => res.json()).then(data => setNews(data)).catch(() => {});

    const timer = setInterval(() => {
      const timestamp = new Date().getTime();
      setQrCode(`https://vov-lms-giangvien.vercel.app/checkin?t=${timestamp}&secret=VOV2026`);
    }, 30000); // Đổi mã sau 30 giây

    return () => clearInterval(timer);
  }, []);

  const handleLogin = (res: any) => {
    const decoded: any = jwt_decode(res.credential);
    const role = decoded.email === 'phamanhvu@vov.edu.vn' ? 'Giảng viên' : 'Sinh viên';
    setUser({ ...decoded, role });
  };

  const handleSummarize = async () => {
    setSummaryResult("Đang kết nối Gemini API để tóm tắt...");
    // Logic gọi API Gemini sẽ được thực hiện tại /api/summarize
    const res = await fetch('/api/summarize', {
      method: 'POST',
      body: JSON.stringify({ text: summaryText })
    });
    const data = await res.json();
    setSummaryResult(data.summary || "Lỗi kết nối AI.");
  };

  if (!user) {
    return (
      <GoogleOAuthProvider clientId={CLIENT_ID}>
        <div className="login-screen" style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h1 style={{ color: '#004a99', marginBottom: '10px' }}>VOV LMS 2026</h1>
            <p style={{ color: '#64748b', marginBottom: '30px' }}>Hệ thống Quản lý Học tập Thế hệ mới</p>
            <GoogleLogin onSuccess={handleLogin} onError={() => {}} />
          </motion.div>
        </div>
      </GoogleOAuthProvider>
    );
  }

  return (
    <div className="lms-app" style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {/* Header Phân Quyền */}
      <header style={{ background: 'white', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #004a99' }}>
        <div style={{ fontWeight: 'bold', fontSize: '20px', color: '#004a99' }}>VOV COLLEGE</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span>{user.name} <span style={{ fontSize: '12px', background: '#004a99', color: 'white', padding: '2px 8px', borderRadius: '10px' }}>{user.role}</span></span>
          <button onClick={() => setUser(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><LogOut size={20} /></button>
        </div>
      </header>

      <div className="layout" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '25px', padding: '25px' }}>
        {/* Cột Trái: Chức năng chính */}
        <div className="main-content">
          {user.role === 'Giảng viên' ? (
            <section className="admin-panel">
              <div style={{ background: 'white', padding: '25px', borderRadius: '15px', marginBottom: '25px', textAlign: 'center' }}>
                <h3><Shield size={20} inline /> MÃ ĐIỂM DANH SINH VIÊN (QR)</h3>
                <p style={{ fontSize: '13px', color: '#ef4444' }}>Mã này sẽ tự động thay đổi sau 30 giây để bảo mật</p>
                <div style={{ padding: '20px' }}>
                  <QRCodeCanvas value={qrCode} size={200} level={"H"} includeMargin={true} />
                </div>
                <button className="btn">Xem danh sách lớp (Sheets)</button>
              </div>
            </section>
          ) : (
            <section className="student-panel">
              <div style={{ background: 'white', padding: '25px', borderRadius: '15px', marginBottom: '25px' }}>
                <h3><Cpu size={20} inline /> TRỢ LÝ AI GEMINI - TÓM TẮT BÀI GIẢNG</h3>
                <textarea 
                  placeholder="Dán nội dung bài giảng vào đây..." 
                  style={{ width: '100%', height: '100px', marginTop: '15px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                  onChange={(e) => setSummaryText(e.target.value)}
                />
                <button onClick={handleSummarize} style={{ marginTop: '10px', background: '#004a99', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none' }}>Tóm tắt ngay</button>
                {summaryResult && <div style={{ marginTop: '15px', padding: '15px', background: '#f8fafc', borderRadius: '8px', fontSize: '14px', fontStyle: 'italic' }}>{summaryResult}</div>}
              </div>
            </section>
          )}

          <div className="courses">
            <h3 style={{ marginBottom: '15px' }}><BookOpen size={20} inline /> Học phần của tôi</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="course-card" style={{ background: 'white', padding: '20px', borderRadius: '15px' }}>
                <h4>Lập trình Web</h4>
                <a href="LINK_DRIVE_CUA_BAN" target="_blank" className="btn">Vào lớp học</a>
              </div>
              <div className="course-card" style={{ background: 'white', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '15px' }}>
                <span>+ ĐĂNG KÝ LỚP MỚI</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cột Phải: Tin tức Scraper */}
        <aside style={{ background: 'white', padding: '20px', borderRadius: '15px', height: 'fit-content' }}>
          <h3>Tin tức & Sự kiện</h3>
          <div style={{ marginTop: '20px' }}>
            {news.map((n: any, i) => (
              <div key={i} style={{ marginBottom: '15px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                <a href={n.link} target="_blank" style={{ fontWeight: '500', color: '#1e293b', textDecoration: 'none', fontSize: '14px' }}>{n.title}</a>
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>{n.date}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
