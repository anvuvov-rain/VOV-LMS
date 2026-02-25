/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Users, 
  BookOpen, 
  LogOut, 
  CheckCircle, 
  Clock, 
  Plus, 
  FileText, 
  Sparkles,
  ChevronRight,
  LayoutDashboard,
  ShieldCheck,
  ClipboardList,
  Megaphone,
  BarChart3,
  MessageSquare,
  Award,
  Settings,
  Download,
  Upload,
  Video,
  Music,
  ExternalLink,
  Trash2,
  MonitorPlay,
  Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';
import { io, Socket } from 'socket.io-client';
import { GoogleGenAI } from "@google/genai";

// Types
type Role = 'admin' | 'lecturer' | 'student';
interface User {
  id: number;
  username: string;
  role: Role;
  name: string;
  group_name?: string;
}

interface Course {
  id: number;
  name: string;
}

interface Material {
  id: number;
  title: string;
  content: string;
  summary: string;
}

interface AttendanceRecord {
  id: number;
  name: string;
  timestamp: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'login' | 'dashboard' | 'course' | 'attendance' | 'admin'>('login');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseTab, setCourseTab] = useState<'materials' | 'students' | 'quizzes' | 'assignments' | 'announcements' | 'reports'>('materials');
  const [courses, setCourses] = useState<Course[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminGroups, setAdminGroups] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<{ id: number; code: string; expiresAt: string } | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');
  const [newsList, setNewsList] = useState<any[]>([]);
  const [presentationResources, setPresentationResources] = useState<any[]>([]);
  const [activePresentation, setActivePresentation] = useState<any | null>(null);
  
  // Quiz State
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<any | null>(null);
  const [quizSubmissions, setQuizSubmissions] = useState<Record<number, any>>({});
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [newQuiz, setNewQuiz] = useState({
    title: '',
    description: '',
    timeLimit: 30,
    questions: [{ question_text: '', options: [{ option_text: '', is_correct: true }, { option_text: '', is_correct: false }] }]
  });

  // Auth State persistence
  useEffect(() => {
    // Device ID initialization
    let dId = localStorage.getItem('vov_device_id');
    if (!dId) {
      dId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('vov_device_id', dId);
    }
    setDeviceId(dId);

    const savedUser = localStorage.getItem('vibecheck_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setView('dashboard');
    }

    // Handle URL attendance code
    const params = new URLSearchParams(window.location.search);
    const code = params.get('attendanceCode');
    if (code) {
      localStorage.setItem('pending_attendance_code', code);
      // Remove param from URL without refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (user && localStorage.getItem('pending_attendance_code')) {
      const code = localStorage.getItem('pending_attendance_code')!;
      localStorage.removeItem('pending_attendance_code');
      checkAttendance(code);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchCourses();
      fetchNews();
      const newSocket = io();
      setSocket(newSocket);
      return () => { newSocket.close(); };
    }
  }, [user]);

  const fetchCourses = async () => {
    if (!user) return;
    const res = await fetch(`/api/courses?userId=${user.id}&role=${user.role}`);
    const data = await res.json();
    setCourses(data);

    if (user.role === 'student') {
      const availRes = await fetch(`/api/courses/available?userId=${user.id}`);
      setAvailableCourses(await availRes.json());
    }
  };

  const enrollCourse = async (courseId: number) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/courses/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, courseId })
      });
      if (res.ok) {
        fetchCourses();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchNews = async () => {
    // URL placeholder for now
    const schoolUrl = ''; 
    const res = await fetch(`/api/news/scrape${schoolUrl ? `?url=${encodeURIComponent(schoolUrl)}` : ''}`);
    const data = await res.json();
    setNewsList(data);
  };

  const fetchPresentationResources = async (materialId: number) => {
    const res = await fetch(`/api/materials/${materialId}/resources`);
    setPresentationResources(await res.json());
  };

  const addPresentationResource = async (materialId: number, title: string, url: string, type: string) => {
    await fetch(`/api/materials/${materialId}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url, type })
    });
    fetchPresentationResources(materialId);
  };

  const deletePresentationResource = async (resourceId: number, materialId: number) => {
    await fetch(`/api/materials/resources/${resourceId}`, { method: 'DELETE' });
    fetchPresentationResources(materialId);
  };

  useEffect(() => {
    if (view === 'course' && selectedCourse) {
      fetchActiveSession();
      if (courseTab === 'students') fetchStudents();
      if (courseTab === 'quizzes') fetchQuizzes();
      if (courseTab === 'assignments') fetchAssignments();
      if (courseTab === 'announcements') fetchAnnouncements();
      if (courseTab === 'reports') fetchReports();
    }
    if (view === 'admin') {
      fetchAdminData();
    }
  }, [view, selectedCourse, courseTab]);

  const fetchActiveSession = async () => {
    if (!selectedCourse) return;
    try {
      const res = await fetch(`/api/attendance/active/${selectedCourse.id}`);
      if (!res.ok) throw new Error('Failed to fetch active session');
      const data = await res.json();
      if (data && data.code) {
        setActiveSession({ id: data.id, code: data.code, expiresAt: data.expiresAt });
        const recordsRes = await fetch(`/api/attendance/records/${data.id}`);
        if (recordsRes.ok) {
          setAttendanceRecords(await recordsRes.json());
        }
        socket?.emit('join-session', data.id);
      } else {
        setActiveSession(null);
      }
    } catch (error) {
      console.error("Error fetching active session:", error);
      setActiveSession(null);
    }
  };

  const endAttendance = async () => {
    if (!activeSession) return;
    await fetch(`/api/attendance/end/${activeSession.id}`, { method: 'POST' });
    setActiveSession(null);
    setView('course');
  };

  const fetchQuizzes = async () => {
    if (!selectedCourse || !user) return;
    const res = await fetch(`/api/courses/${selectedCourse.id}/quizzes`);
    const data = await res.json();
    setQuizzes(data);
    
    // Fetch submissions for each quiz
    const subs: Record<number, any> = {};
    for (const q of data) {
      const sRes = await fetch(`/api/quizzes/${q.id}/submissions/${user.id}`);
      const sData = await sRes.json();
      if (sData) subs[q.id] = sData;
    }
    setQuizSubmissions(subs);
  };

  const fetchAssignments = async () => {
    if (!selectedCourse) return;
    const res = await fetch(`/api/courses/${selectedCourse.id}/assignments`);
    setAssignments(await res.json());
  };

  const fetchAnnouncements = async () => {
    const url = selectedCourse && view === 'course' 
      ? `/api/announcements?courseId=${selectedCourse.id}` 
      : '/api/announcements';
    const res = await fetch(url);
    setAnnouncements(await res.json());
  };

  const fetchReports = async () => {
    if (!selectedCourse) return;
    const res = await fetch(`/api/reports/progress/${selectedCourse.id}`);
    setReports(await res.json());
  };

  const fetchAdminData = async () => {
    const [usersRes, groupsRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/groups')
    ]);
    setAdminUsers(await usersRes.json());
    setAdminGroups(await groupsRes.json());
  };

  const fetchStudents = async () => {
    if (!selectedCourse) return;
    const res = await fetch(`/api/courses/${selectedCourse.id}/students`);
    setStudents(await res.json());
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData))
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      localStorage.setItem('vibecheck_user', JSON.stringify(data));
      setView('dashboard');
    } else {
      alert('Sai tài khoản hoặc mật khẩu');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('vibecheck_user');
    setView('login');
  };

  const startAttendance = async (courseId: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, durationMinutes: 5 })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Không thể khởi tạo phiên điểm danh');
      }

      const data = await res.json();
      if (data && data.code) {
        setActiveSession(data);
        setAttendanceRecords([]);
        setView('attendance');
        socket?.emit('join-session', data.id);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (socket && activeSession) {
      socket.on('new-attendance', (record: AttendanceRecord) => {
        setAttendanceRecords(prev => [record, ...prev]);
      });
    }
    return () => { socket?.off('new-attendance'); };
  }, [socket, activeSession]);

  const checkAttendance = async (code: string) => {
    if (!user) {
      alert('Vui lòng đăng nhập để điểm danh');
      setView('login');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/attendance/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, studentId: user.id, deviceId })
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      alert('Điểm danh thành công!');
    } else {
      alert(data.error);
    }
  };

  const generateSummary = async (content: string) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Tóm tắt nội dung sau đây thành 3 dòng ngắn gọn và 5 từ khóa chính: ${content}`,
      });
      return response.text || "Không thể tạo tóm tắt";
    } catch (e) {
      return "Lỗi AI: " + e;
    }
  };

  const addMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const content = formData.get('content') as string;
    const summary = await generateSummary(content);
    
    await fetch('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: selectedCourse.id,
        title: formData.get('title'),
        content,
        summary,
        type: formData.get('type'),
        file_url: formData.get('file_url')
      })
    });
    
    const res = await fetch(`/api/materials/${selectedCourse.id}`);
    setMaterials(await res.json());
    setLoading(false);
    (e.target as HTMLFormElement).reset();
  };

  const startQuiz = async (quiz: any) => {
    if (quizSubmissions[quiz.id]) {
      alert('Bạn đã hoàn thành bài thi này!');
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/quizzes/${quiz.id}/questions`);
    const questions = await res.json();
    setQuizQuestions(questions);
    setActiveQuiz(quiz);
    setQuizAnswers({});
    setQuizResult(null);
    setLoading(false);
  };

  const submitQuiz = async () => {
    if (!activeQuiz || !user) return;
    if (Object.keys(quizAnswers).length < quizQuestions.length) {
      if (!confirm('Bạn chưa trả lời hết các câu hỏi. Vẫn muốn nộp bài?')) return;
    }

    setLoading(true);
    const res = await fetch(`/api/quizzes/${activeQuiz.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: user.id,
        answers: quizAnswers
      })
    });
    const result = await res.json();
    setQuizResult(result);
    setLoading(false);
    fetchQuizzes(); // Refresh submissions
  };

  const createFullQuiz = async () => {
    if (!selectedCourse) return;
    setLoading(true);
    await fetch('/api/quizzes/full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: selectedCourse.id,
        ...newQuiz
      })
    });
    setIsCreatingQuiz(false);
    setNewQuiz({
      title: '',
      description: '',
      timeLimit: 30,
      questions: [{ question_text: '', options: [{ option_text: '', is_correct: true }, { option_text: '', is_correct: false }] }]
    });
    fetchQuizzes();
    setLoading(false);
  };

  const deleteMaterial = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tài liệu này?')) return;
    await fetch(`/api/materials/${id}`, { method: 'DELETE' });
    if (selectedCourse) {
      const res = await fetch(`/api/materials/${selectedCourse.id}`);
      setMaterials(await res.json());
    }
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute top-0 left-0 w-full h-2 bg-vov-red" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-vov-blue/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-vov-red/5 rounded-full blur-3xl" />

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-md border border-gray-100 relative z-10"
        >
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-vov-red rounded-full flex items-center justify-center text-white shadow-xl shadow-red-200 mb-4">
              <QrCode size={40} />
            </div>
            <h1 className="text-4xl font-serif font-black text-vov-blue tracking-tight">VOV LMS</h1>
            <p className="text-[10px] font-bold text-vov-red uppercase tracking-[0.2em] mt-1">VOV College Portal</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Tên đăng nhập</label>
              <input 
                name="username"
                type="text" 
                required
                className="w-full px-6 py-4 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-vov-blue focus:ring-4 focus:ring-vov-blue/10 outline-none transition-all font-medium"
                placeholder="Mã số sinh viên / Giảng viên"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Mật khẩu</label>
              <input 
                name="password"
                type="password" 
                required
                className="w-full px-6 py-4 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-vov-blue focus:ring-4 focus:ring-vov-blue/10 outline-none transition-all font-medium"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-vov-red text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-200 active:scale-[0.98]"
            >
              Đăng nhập hệ thống
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-gray-50 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4">Hỗ trợ kỹ thuật</p>
            <div className="flex justify-center gap-4 text-vov-blue">
              <button className="text-xs font-bold hover:text-vov-red transition-colors">Quên mật khẩu?</button>
              <span className="text-gray-200">|</span>
              <button className="text-xs font-bold hover:text-vov-red transition-colors">Hướng dẫn sử dụng</button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-[#1a1a1a]">
      {/* Top Bar */}
      <div className="bg-vov-red text-white px-6 py-1 text-[10px] font-bold uppercase tracking-widest flex justify-between items-center">
        <span>Trường Cao đẳng Phát thanh - Truyền hình II (VOV College)</span>
        <div className="flex gap-4">
          <span>Hotline: 0917167777</span>
          <span>Email: phamanhvu@vov.edu.vn</span>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="bg-white border-b-4 border-vov-blue px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView('dashboard')}>
          <div className="w-12 h-12 bg-vov-red rounded-full flex items-center justify-center text-white shadow-lg">
            <QrCode size={24} />
          </div>
          <div>
            <h1 className="font-serif font-black text-2xl text-vov-blue leading-none">VOV LMS</h1>
            <p className="text-[10px] font-bold text-vov-red uppercase tracking-tighter">Hệ thống quản lý học tập</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex gap-6 text-sm font-bold text-gray-600 uppercase tracking-wide">
            <button onClick={() => setView('dashboard')} className="hover:text-vov-red transition-colors">Trang chủ</button>
            <button className="hover:text-vov-red transition-colors">Tin tức</button>
            <button className="hover:text-vov-red transition-colors">Thông báo</button>
          </div>

          <div className="h-8 w-px bg-gray-200 hidden sm:block" />

          <div className="flex items-center gap-4">
            {user?.role === 'admin' && (
              <button 
                onClick={() => setView('admin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${view === 'admin' ? 'bg-vov-red text-white' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                <ShieldCheck size={18} />
                <span className="text-sm font-bold">Quản trị</span>
              </button>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-vov-blue">{user?.name}</p>
              <p className="text-[10px] text-vov-red font-bold uppercase tracking-wider">{user?.role === 'lecturer' ? 'Giảng viên' : 'Sinh viên'}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors border border-transparent hover:border-red-100"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Hero Banner */}
              <div className="relative h-64 rounded-[40px] overflow-hidden shadow-2xl group">
                <img 
                  src="https://picsum.photos/seed/vov/1200/400" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  alt="VOV College"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-vov-blue/90 to-transparent flex items-center px-12">
                  <div className="text-white max-w-2xl">
                    <h2 className="text-2xl font-serif font-bold mb-4 leading-tight">
                      Chúng ta là những gì chúng ta liên tục làm. Do đó, xuất sắc không phải là một hành động, mà là một thói quen - Kiên trì với những công việc nhỏ, bạn sẽ trở thành người xuất sắc.
                    </h2>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <header className="flex items-center justify-between border-b-2 border-vov-red pb-4">
                    <h3 className="text-2xl font-serif font-bold text-vov-blue flex items-center gap-2">
                      <BookOpen size={24} className="text-vov-red" />
                      Học phần của tôi
                    </h3>
                    <div className="bg-white px-4 py-2 rounded-full border border-gray-100 flex items-center gap-2 text-xs font-bold text-gray-500 shadow-sm">
                      <Clock size={14} className="text-vov-red" />
                      Học kỳ II - Năm học 2025-2026
                    </div>
                  </header>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {courses.map((course) => (
                      <motion.div 
                        key={course.id}
                        whileHover={{ y: -8, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                        className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden cursor-pointer group flex flex-col"
                        onClick={async () => {
                          setSelectedCourse(course);
                          setCourseTab('materials');
                          const res = await fetch(`/api/materials/${course.id}`);
                          setMaterials(await res.json());
                          setView('course');
                        }}
                      >
                        <div className="h-32 bg-vov-blue/5 relative overflow-hidden">
                           <div className="absolute top-4 left-4 bg-vov-red text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest z-10">
                             Đang diễn ra
                           </div>
                           <img 
                             src={`https://picsum.photos/seed/${course.id}/400/200`} 
                             className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500"
                             alt={course.name}
                             referrerPolicy="no-referrer"
                           />
                        </div>
                        <div className="p-6 flex-1 flex flex-col">
                          <h3 className="text-xl font-bold mb-2 group-hover:text-vov-red transition-colors">{course.name}</h3>
                          <p className="text-xs text-gray-400 mb-6 font-mono">MÃ HP: {course.id.toString().padStart(4, '0')}</p>
                          <div className="mt-auto flex items-center justify-between text-vov-blue font-bold text-sm">
                            <span className="flex items-center gap-1">Vào lớp học <ChevronRight size={16} /></span>
                            <div className="flex -space-x-2">
                              {[1,2,3].map(i => (
                                <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-200" />
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    
                    {user?.role === 'lecturer' && (
                      <div className="bg-white border-2 border-dashed border-gray-200 rounded-[32px] p-6 flex flex-col items-center justify-center text-gray-400 hover:border-vov-red hover:text-vov-red transition-all cursor-pointer group">
                        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-2 group-hover:bg-vov-red/10 transition-colors">
                          <Plus size={32} />
                        </div>
                        <span className="font-bold text-sm uppercase tracking-widest">Đăng ký lớp mới</span>
                      </div>
                    )}
                  </div>

                  {user?.role === 'student' && availableCourses.length > 0 && (
                    <div className="mt-12 space-y-6">
                      <header className="flex items-center justify-between border-b-2 border-gray-100 pb-4">
                        <h3 className="text-xl font-serif font-bold text-vov-blue flex items-center gap-2">
                          <Plus size={20} className="text-vov-red" />
                          Đăng ký học phần mới
                        </h3>
                      </header>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {availableCourses.map((course) => (
                          <div key={course.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center justify-between group">
                            <div>
                              <h4 className="font-bold text-vov-blue group-hover:text-vov-red transition-colors">{course.name}</h4>
                              <p className="text-[10px] text-gray-400 font-mono mt-1 uppercase tracking-widest">Mã HP: {course.id.toString().padStart(4, '0')}</p>
                            </div>
                            <button 
                              onClick={() => enrollCourse(course.id)}
                              disabled={loading}
                              className="bg-vov-blue text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all disabled:opacity-50"
                            >
                              {loading ? '...' : 'Đăng ký'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-1 space-y-6">
                  {/* News Section */}
                  <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                    <h3 className="font-bold mb-6 flex items-center gap-2 text-vov-blue border-b border-gray-100 pb-4">
                      <Megaphone size={18} className="text-vov-red" /> Tin tức & Sự kiện
                    </h3>
                    <div className="space-y-6">
                      {newsList.map((news, i) => (
                        <div key={i} className="flex gap-4 group cursor-pointer">
                          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0">
                            <img 
                              src={news.img.startsWith('http') ? news.img : `https://picsum.photos/seed/${news.img}/100/100`} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                              alt={news.title} 
                              referrerPolicy="no-referrer" 
                            />
                          </div>
                          <div className="flex flex-col justify-center">
                            <h4 className="text-sm font-bold leading-tight group-hover:text-vov-red transition-colors line-clamp-2">{news.title}</h4>
                            <p className="text-[10px] text-gray-400 mt-1">{news.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="w-full mt-6 py-2 text-xs font-bold text-vov-blue hover:text-vov-red transition-colors border-t border-gray-50 pt-4">
                      Xem tất cả tin tức
                    </button>
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-vov-blue text-white p-6 rounded-[32px] shadow-xl relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                      <QrCode size={120} />
                    </div>
                    <h4 className="font-bold mb-4 flex items-center gap-2">
                      <Award size={18} className="text-vov-gold" /> Thành tích học tập
                    </h4>
                    <div className="space-y-4 relative z-10">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/70">Số tín chỉ tích lũy</span>
                        <span className="font-black text-vov-gold">42</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/70">Điểm trung bình (GPA)</span>
                        <span className="font-black text-vov-gold">3.65</span>
                      </div>
                      <div className="h-1 w-full bg-white/10 rounded-full mt-4">
                        <div className="h-full bg-vov-gold w-[85%] rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'course' && selectedCourse && (
            <motion.div 
              key="course"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-4 border-b border-gray-200 pb-4">
                <button onClick={() => setView('dashboard')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-vov-blue">
                  <LayoutDashboard size={24} />
                </button>
                <div>
                  <h2 className="text-3xl font-serif font-bold text-vov-blue">{selectedCourse.name}</h2>
                  <p className="text-xs text-vov-red font-bold uppercase tracking-widest">Học phần chuyên ngành</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Tabs */}
                  <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar bg-white rounded-t-3xl px-4">
                    {[
                      { id: 'materials', label: 'Tài liệu', icon: FileText },
                      { id: 'teaching', label: 'Giảng dạy', icon: MonitorPlay },
                      { id: 'announcements', label: 'Thông báo', icon: Megaphone },
                      { id: 'quizzes', label: 'Kiểm tra', icon: ClipboardList },
                      { id: 'assignments', label: 'Bài tập', icon: BookOpen },
                      { id: 'students', label: 'Sinh viên', icon: Users, lecturerOnly: true },
                      { id: 'reports', label: 'Báo cáo', icon: BarChart3, lecturerOnly: true },
                    ].filter(tab => !tab.lecturerOnly || user?.role === 'lecturer' || user?.role === 'admin').map(tab => (
                      <button 
                        key={tab.id}
                        onClick={() => setCourseTab(tab.id as any)}
                        className={`px-6 py-4 font-bold transition-all flex items-center gap-2 whitespace-nowrap text-sm uppercase tracking-wide ${courseTab === tab.id ? 'border-b-4 border-vov-red text-vov-red' : 'text-gray-400 hover:text-vov-blue'}`}
                      >
                        <tab.icon size={16} />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {courseTab === 'materials' && (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-vov-blue">
                          <FileText size={20} className="text-vov-red" />
                          Tài liệu học tập
                        </h3>
                        <div className="flex gap-2">
                          <button className="p-2 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-vov-red transition-all shadow-sm">
                            <Download size={18} />
                          </button>
                        </div>
                      </div>

                      {user?.role === 'lecturer' && (
                        <form onSubmit={addMaterial} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-lg space-y-6">
                          <div className="flex flex-col md:flex-row gap-4">
                            <input 
                              name="title"
                              placeholder="Tiêu đề bài giảng..."
                              required
                              className="flex-1 px-4 py-3 border-b-2 border-gray-50 outline-none focus:border-vov-red transition-colors font-bold text-lg"
                            />
                            <select name="type" className="bg-gray-50 px-6 py-3 rounded-2xl text-sm font-bold outline-none border-none text-vov-blue">
                              <option value="document">Tài liệu (PDF/Word)</option>
                              <option value="video">Video bài giảng</option>
                              <option value="audio">Audio / Podcast</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Liên kết tài liệu (URL)</label>
                            <input 
                              name="file_url"
                              placeholder="https://example.com/file.pdf"
                              className="w-full px-6 py-3 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-vov-red/20 transition-all font-mono text-xs"
                            />
                          </div>
                          <textarea 
                            name="content"
                            placeholder="Nội dung tóm tắt hoặc ghi chú quan trọng cho sinh viên..."
                            required
                            rows={4}
                            className="w-full px-6 py-4 bg-gray-50 rounded-[32px] outline-none focus:ring-2 focus:ring-vov-red/20 transition-all resize-none"
                          />
                          <div className="flex items-center justify-between">
                            <div className="flex gap-3">
                              <button type="button" className="p-3 bg-gray-50 text-gray-400 hover:text-vov-red rounded-2xl transition-all" title="Tải lên file"><Upload size={20} /></button>
                              <button type="button" className="p-3 bg-gray-50 text-gray-400 hover:text-vov-red rounded-2xl transition-all" title="Thêm video"><Video size={20} /></button>
                            </div>
                            <button 
                              disabled={loading}
                              className="flex items-center gap-2 bg-vov-red text-white px-8 py-3 rounded-full font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                            >
                              {loading ? 'Đang xử lý AI...' : <><Sparkles size={18} /> Đăng bài & Tóm tắt AI</>}
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-6">
                        {materials.map(m => (
                          <div key={m.id} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-md transition-all group relative">
                            {user?.role === 'lecturer' && (
                              <button 
                                onClick={() => deleteMaterial(m.id)}
                                className="absolute top-6 right-6 p-2 text-gray-300 hover:text-vov-red transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                            <div className="flex items-start gap-6 mb-6">
                              <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center ${
                                m.type === 'video' ? 'bg-red-50 text-vov-red' : 
                                m.type === 'audio' ? 'bg-blue-50 text-vov-blue' : 
                                'bg-emerald-50 text-emerald-600'
                              }`}>
                                {m.type === 'video' ? <Video size={32} /> : m.type === 'audio' ? <Music size={32} /> : <FileText size={32} />}
                              </div>
                              <div>
                                <h4 className="font-black text-2xl text-vov-blue leading-tight">{m.title}</h4>
                                <div className="flex gap-2 mt-2">
                                  <span className="text-[9px] uppercase font-black tracking-widest px-3 py-1 bg-gray-100 text-gray-500 rounded-full">
                                    {m.type === 'video' ? 'Video' : m.type === 'audio' ? 'Audio' : 'Tài liệu'}
                                  </span>
                                  {m.file_url && (
                                    <a 
                                      href={m.file_url} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="text-[9px] uppercase font-black tracking-widest px-3 py-1 bg-vov-blue text-white rounded-full hover:bg-blue-800 transition-colors flex items-center gap-1"
                                    >
                                      <ExternalLink size={10} /> Xem tài liệu
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="bg-vov-blue/5 p-6 rounded-[32px] mb-6 border border-vov-blue/10">
                              <p className="text-xs font-black text-vov-blue uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Sparkles size={14} className="text-vov-red" /> Tóm tắt nội dung chính (AI)
                              </p>
                              <p className="text-sm text-gray-700 italic leading-relaxed whitespace-pre-line">{m.summary}</p>
                            </div>
                            
                            <div className="px-4">
                              <p className="text-gray-600 text-sm leading-relaxed">{m.content}</p>
                            </div>
                          </div>
                        ))}
                        {materials.length === 0 && (
                          <div className="text-center py-20 text-gray-400 italic bg-white rounded-[40px] border border-dashed border-gray-200">
                            Chưa có tài liệu nào được đăng tải cho học phần này.
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {courseTab === 'teaching' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-vov-blue">
                          <MonitorPlay size={20} className="text-vov-red" />
                          Giảng dạy & Thuyết trình
                        </h3>
                      </div>

                      {user?.role === 'lecturer' && !activePresentation && (
                        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-lg space-y-6">
                          <h4 className="font-bold text-vov-blue uppercase tracking-widest text-xs">Đăng tải bài giảng PPTX mới</h4>
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const title = formData.get('title') as string;
                            const url = formData.get('url') as string;
                            addMaterial({
                              preventDefault: () => {},
                              currentTarget: {
                                title: { value: title },
                                type: { value: 'presentation' },
                                file_url: { value: url },
                                content: { value: 'Bài giảng PPTX' },
                                reset: () => (e.currentTarget as HTMLFormElement).reset()
                              }
                            } as any);
                          }} className="space-y-4">
                            <input name="title" placeholder="Tiêu đề bài giảng (ví dụ: Chương 1: Giới thiệu...)" required className="w-full px-4 py-3 border-b-2 border-gray-50 outline-none focus:border-vov-red font-bold" />
                            <input name="url" placeholder="Dán link file PPTX (Google Drive/OneDrive/Dropbox)..." required className="w-full px-4 py-3 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-vov-red/20 font-mono text-xs" />
                            <div className="flex justify-end">
                              <button type="submit" className="bg-vov-red text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-red-700 transition-all flex items-center gap-2">
                                <Upload size={18} /> Tải lên bài giảng
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {activePresentation ? (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between bg-white p-4 rounded-[32px] border border-gray-100">
                            <h4 className="font-black text-vov-blue ml-4">{activePresentation.title}</h4>
                            <button onClick={() => setActivePresentation(null)} className="text-xs font-black text-vov-red uppercase tracking-widest px-4 py-2 hover:bg-red-50 rounded-full transition-all">Thoát chế độ giảng dạy</button>
                          </div>
                          
                          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <div className="lg:col-span-3 aspect-video bg-black rounded-[40px] overflow-hidden shadow-2xl border-8 border-white">
                              <iframe 
                                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(activePresentation.file_url)}`}
                                width="100%" 
                                height="100%" 
                                frameBorder="0"
                                title="PPTX Viewer"
                              >
                                This is an embedded <a target="_blank" href="https://office.com">Microsoft Office</a> presentation, powered by <a target="_blank" href="https://office.com/webapps">Office Online</a>.
                              </iframe>
                            </div>
                            
                            <div className="space-y-6">
                              <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm h-full">
                                <h5 className="font-black text-xs text-vov-blue uppercase tracking-widest mb-4 flex items-center gap-2">
                                  <Link2 size={14} className="text-vov-red" /> Tài liệu minh họa
                                </h5>
                                
                                {user?.role === 'lecturer' && (
                                  <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.currentTarget);
                                    addPresentationResource(activePresentation.id, formData.get('title') as string, formData.get('url') as string, 'link');
                                    (e.currentTarget as HTMLFormElement).reset();
                                  }} className="mb-6 space-y-2">
                                    <input name="title" placeholder="Tên tài liệu/clip..." className="w-full px-3 py-2 text-xs bg-gray-50 rounded-lg outline-none" />
                                    <input name="url" placeholder="URL (Youtube/Web)..." className="w-full px-3 py-2 text-xs bg-gray-50 rounded-lg outline-none" />
                                    <button className="w-full py-2 bg-vov-blue text-white text-[10px] font-black uppercase rounded-lg">Thêm link</button>
                                  </form>
                                )}

                                <div className="space-y-3">
                                  {presentationResources.map(res => (
                                    <div key={res.id} className="p-3 bg-gray-50 rounded-2xl group relative">
                                      <a href={res.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-vov-blue hover:text-vov-red transition-colors block pr-6">{res.title}</a>
                                      {user?.role === 'lecturer' && (
                                        <button onClick={() => deletePresentationResource(res.id, activePresentation.id)} className="absolute top-3 right-3 text-gray-300 hover:text-vov-red opacity-0 group-hover:opacity-100 transition-all">
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {presentationResources.length === 0 && <p className="text-[10px] text-gray-400 italic text-center py-4">Chưa có tài liệu minh họa</p>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {materials.filter(m => m.type === 'presentation').map(m => (
                            <div key={m.id} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
                              <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
                                  <MonitorPlay size={28} />
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-black text-lg text-vov-blue leading-tight">{m.title}</h4>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Bài giảng PPTX</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => {
                                  setActivePresentation(m);
                                  fetchPresentationResources(m.id);
                                }}
                                className="w-full py-4 bg-vov-blue text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-800 transition-all shadow-lg shadow-blue-100"
                              >
                                Bắt đầu giảng dạy
                              </button>
                            </div>
                          ))}
                          {materials.filter(m => m.type === 'presentation').length === 0 && (
                            <div className="col-span-full text-center py-20 text-gray-400 italic bg-white rounded-[40px] border border-dashed border-gray-200">
                              Chưa có bài giảng PPTX nào.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {courseTab === 'announcements' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-vov-blue">
                          <Megaphone size={20} className="text-vov-red" />
                          Bảng tin lớp học
                        </h3>
                      </div>
                      
                      {user?.role === 'lecturer' && (
                        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-lg space-y-4">
                          <input placeholder="Tiêu đề thông báo quan trọng..." className="w-full px-4 py-3 border-b-2 border-gray-50 outline-none focus:border-vov-red font-bold text-lg" />
                          <textarea placeholder="Nội dung chi tiết thông báo gửi đến sinh viên..." rows={3} className="w-full px-6 py-4 bg-gray-50 rounded-[32px] outline-none focus:ring-2 focus:ring-vov-red/20" />
                          <div className="flex justify-end">
                            <button className="bg-vov-red text-white px-10 py-3 rounded-full font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all">Đăng thông báo</button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        {announcements.map(a => (
                          <div key={a.id} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute top-0 left-0 w-2 h-full bg-vov-red" />
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-xs font-black text-vov-blue uppercase tracking-widest bg-vov-blue/5 px-3 py-1 rounded-full">{a.creator_name}</span>
                              <span className="text-[10px] text-gray-400 font-bold">{new Date(a.created_at).toLocaleString()}</span>
                            </div>
                            <h4 className="font-black text-xl mb-3 text-vov-blue group-hover:text-vov-red transition-colors">{a.title}</h4>
                            <p className="text-gray-600 text-sm leading-relaxed">{a.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {courseTab === 'quizzes' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-vov-blue">
                          <ClipboardList size={20} className="text-vov-red" />
                          Bài kiểm tra & Đánh giá
                        </h3>
                        {user?.role === 'lecturer' && (
                          <button 
                            onClick={() => setIsCreatingQuiz(true)}
                            className="flex items-center gap-2 text-sm font-black text-vov-red hover:underline uppercase tracking-widest"
                          >
                            <Plus size={16} /> Tạo bài thi mới
                          </button>
                        )}
                      </div>

                      {isCreatingQuiz && (
                        <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-2xl space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-6">
                            <h4 className="text-3xl font-serif font-black text-vov-blue">Thiết lập bài thi mới</h4>
                            <button onClick={() => setIsCreatingQuiz(false)} className="text-gray-400 hover:text-vov-red font-black uppercase tracking-widest text-xs">Hủy bỏ</button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Tiêu đề bài thi</label>
                              <input 
                                value={newQuiz.title}
                                onChange={e => setNewQuiz({...newQuiz, title: e.target.value})}
                                placeholder="Kiểm tra giữa kỳ..."
                                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-vov-red/20 font-bold"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Thời gian (phút)</label>
                              <input 
                                type="number"
                                value={newQuiz.timeLimit}
                                onChange={e => setNewQuiz({...newQuiz, timeLimit: parseInt(e.target.value)})}
                                className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-vov-red/20 font-bold"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Mô tả ngắn</label>
                            <textarea 
                              value={newQuiz.description}
                              onChange={e => setNewQuiz({...newQuiz, description: e.target.value})}
                              placeholder="Nội dung bao gồm chương 1 đến chương 3..."
                              className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-vov-red/20"
                            />
                          </div>

                          <div className="space-y-8">
                            <div className="flex items-center justify-between">
                              <h5 className="font-black text-vov-blue uppercase tracking-widest text-sm">Danh sách câu hỏi</h5>
                              <button 
                                onClick={() => setNewQuiz({...newQuiz, questions: [...newQuiz.questions, { question_text: '', options: [{ option_text: '', is_correct: true }, { option_text: '', is_correct: false }] }]})}
                                className="text-xs font-black text-vov-red flex items-center gap-1"
                              >
                                <Plus size={14} /> Thêm câu hỏi
                              </button>
                            </div>

                            {newQuiz.questions.map((q, qIdx) => (
                              <div key={qIdx} className="p-8 bg-gray-50 rounded-[40px] space-y-6 relative">
                                <button 
                                  onClick={() => {
                                    const qs = [...newQuiz.questions];
                                    qs.splice(qIdx, 1);
                                    setNewQuiz({...newQuiz, questions: qs});
                                  }}
                                  className="absolute top-6 right-6 text-gray-300 hover:text-vov-red"
                                >
                                  <Trash2 size={18} />
                                </button>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Câu hỏi {qIdx + 1}</label>
                                  <input 
                                    value={q.question_text}
                                    onChange={e => {
                                      const qs = [...newQuiz.questions];
                                      qs[qIdx].question_text = e.target.value;
                                      setNewQuiz({...newQuiz, questions: qs});
                                    }}
                                    placeholder="Nhập nội dung câu hỏi..."
                                    className="w-full px-6 py-4 bg-white rounded-2xl outline-none focus:ring-2 focus:ring-vov-red/20 font-bold"
                                  />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {q.options.map((opt, oIdx) => (
                                    <div key={oIdx} className="flex items-center gap-2">
                                      <input 
                                        type="radio"
                                        checked={opt.is_correct}
                                        onChange={() => {
                                          const qs = [...newQuiz.questions];
                                          qs[qIdx].options = qs[qIdx].options.map((o, idx) => ({...o, is_correct: idx === oIdx}));
                                          setNewQuiz({...newQuiz, questions: qs});
                                        }}
                                        className="w-5 h-5 accent-vov-red"
                                      />
                                      <input 
                                        value={opt.option_text}
                                        onChange={e => {
                                          const qs = [...newQuiz.questions];
                                          qs[qIdx].options[oIdx].option_text = e.target.value;
                                          setNewQuiz({...newQuiz, questions: qs});
                                        }}
                                        placeholder={`Lựa chọn ${oIdx + 1}`}
                                        className="flex-1 px-4 py-2 bg-white rounded-xl outline-none focus:ring-2 focus:ring-vov-red/20 text-sm"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex justify-center pt-6">
                            <button 
                              onClick={createFullQuiz}
                              disabled={loading}
                              className="bg-vov-blue text-white px-16 py-4 rounded-full font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-800 transition-all disabled:opacity-50"
                            >
                              {loading ? 'Đang lưu...' : 'Lưu & Công bố bài thi'}
                            </button>
                          </div>
                        </div>
                      )}

                      {activeQuiz ? (
                        <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-6">
                            <div>
                              <h4 className="text-3xl font-serif font-black text-vov-blue">{activeQuiz.title}</h4>
                              <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">Học phần: {selectedCourse?.name}</p>
                            </div>
                            <button 
                              onClick={() => setActiveQuiz(null)}
                              className="text-gray-400 hover:text-vov-red transition-colors font-black uppercase tracking-widest text-xs"
                            >
                              Thoát bài thi
                            </button>
                          </div>

                          {quizResult ? (
                            <div className="text-center py-12 space-y-6">
                              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-100">
                                <Award size={48} />
                              </div>
                              <h5 className="text-4xl font-serif font-black text-vov-blue">Hoàn thành bài thi!</h5>
                              <div className="text-6xl font-black text-vov-red">{quizResult.score.toFixed(1)} <span className="text-2xl text-gray-300">/ 10</span></div>
                              <p className="text-gray-500 max-w-md mx-auto">Kết quả của bạn đã được ghi nhận vào hệ thống quản lý học tập của VOV College.</p>
                              <button 
                                onClick={() => setActiveQuiz(null)}
                                className="bg-vov-blue text-white px-12 py-4 rounded-full font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-800 transition-all"
                              >
                                Quay lại danh sách
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-10">
                              {quizQuestions.map((q, idx) => (
                                <div key={q.id} className="space-y-6">
                                  <div className="flex items-start gap-4">
                                    <span className="w-10 h-10 bg-vov-blue text-white rounded-xl flex items-center justify-center font-black flex-shrink-0 shadow-lg shadow-blue-100">{idx + 1}</span>
                                    <p className="text-xl font-bold text-vov-blue leading-relaxed pt-1">{q.question_text}</p>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-14">
                                    {q.options.map((opt: any) => (
                                      <button 
                                        key={opt.id}
                                        onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt.id }))}
                                        className={`p-6 rounded-[32px] text-left transition-all border-2 font-bold ${
                                          quizAnswers[q.id] === opt.id 
                                            ? 'bg-vov-red/5 border-vov-red text-vov-red shadow-lg shadow-red-50' 
                                            : 'bg-gray-50 border-transparent text-gray-600 hover:bg-white hover:border-gray-200'
                                        }`}
                                      >
                                        <span className="mr-3 opacity-40">●</span> {opt.option_text}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              <div className="pt-10 border-t border-gray-100 flex justify-center">
                                <button 
                                  onClick={submitQuiz}
                                  disabled={loading}
                                  className="bg-vov-red text-white px-16 py-5 rounded-full font-black uppercase tracking-[0.2em] shadow-2xl shadow-red-200 hover:bg-red-700 transition-all disabled:opacity-50 active:scale-95"
                                >
                                  {loading ? 'Đang nộp bài...' : 'Nộp bài thi ngay'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {quizzes.map(q => {
                            const submission = quizSubmissions[q.id];
                            return (
                              <div key={q.id} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                                {submission && (
                                  <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-2 rounded-bl-[24px] font-black text-xs uppercase tracking-widest shadow-lg">
                                    Đã nộp: {submission.score.toFixed(1)}
                                  </div>
                                )}
                                <div className="flex justify-between items-start mb-6">
                                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${submission ? 'bg-emerald-50 text-emerald-600' : 'bg-vov-red/5 text-vov-red group-hover:bg-vov-red group-hover:text-white'}`}>
                                    {submission ? <CheckCircle size={28} /> : <ClipboardList size={28} />}
                                  </div>
                                  {!submission && <span className="text-[10px] font-black px-3 py-1 bg-amber-100 text-amber-700 rounded-full uppercase tracking-widest">Sắp diễn ra</span>}
                                </div>
                                <h4 className="font-black text-xl mb-2 text-vov-blue">{q.title}</h4>
                                <p className="text-xs text-gray-400 mb-6 line-clamp-2">{q.description}</p>
                                <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                                  <span className="text-xs text-gray-500 font-bold flex items-center gap-1"><Clock size={14} className="text-vov-red" /> {q.time_limit_minutes} phút</span>
                                  {!submission ? (
                                    <button 
                                      onClick={() => startQuiz(q)}
                                      className="text-sm font-black text-vov-blue hover:text-vov-red transition-colors uppercase tracking-widest"
                                    >
                                      Bắt đầu thi
                                    </button>
                                  ) : (
                                    <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Hoàn thành</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {courseTab === 'assignments' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-vov-blue">
                          <BookOpen size={20} className="text-vov-red" />
                          Bài tập & Dự án thực hành
                        </h3>
                      </div>

                      <div className="space-y-4">
                        {assignments.map(a => (
                          <div key={a.id} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all">
                            <div className="flex items-center gap-6">
                              <div className="w-16 h-16 bg-vov-blue/5 text-vov-blue rounded-[24px] flex items-center justify-center">
                                <BookOpen size={32} />
                              </div>
                              <div>
                                <h4 className="font-black text-xl text-vov-blue">{a.title}</h4>
                                <p className="text-xs text-vov-red font-black uppercase tracking-widest mt-1">Hạn nộp: {new Date(a.due_date).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <button className="bg-vov-blue text-white px-10 py-3 rounded-full font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-800 transition-all">Nộp bài tập</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {courseTab === 'students' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-vov-blue">
                          <Users size={20} className="text-vov-red" />
                          Danh sách sinh viên lớp học
                        </h3>
                        <button className="text-xs font-black text-vov-blue flex items-center gap-2 hover:text-vov-red transition-colors uppercase tracking-widest">
                          <Download size={16} /> Xuất danh sách (CSV)
                        </button>
                      </div>
                      
                      <div className="bg-white rounded-[40px] border border-gray-100 overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                          <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black tracking-widest">
                            <tr>
                              <th className="px-8 py-5">Họ và tên</th>
                              <th className="px-8 py-5">Mã số sinh viên</th>
                              <th className="px-8 py-5 text-center">Số buổi hiện diện</th>
                              <th className="px-8 py-5">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {students.map(s => (
                              <tr key={s.id} className="hover:bg-vov-blue/5 transition-colors group">
                                <td className="px-8 py-5 font-bold text-vov-blue">{s.name}</td>
                                <td className="px-8 py-5 text-gray-500 font-mono text-sm">{s.username}</td>
                                <td className="px-8 py-5 text-center font-black text-lg">{s.attendance_count}</td>
                                <td className="px-8 py-5">
                                  <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${s.attendance_count > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-vov-red/10 text-vov-red'}`}>
                                    {s.attendance_count > 0 ? 'Tích cực' : 'Vắng mặt'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {courseTab === 'reports' && (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-vov-blue">
                          <BarChart3 size={20} className="text-vov-red" />
                          Báo cáo & Thống kê học tập
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                          <h4 className="font-black text-vov-blue uppercase tracking-widest text-xs mb-6">Tiến độ hoàn thành khóa học</h4>
                          <div className="h-6 w-full bg-gray-100 rounded-full overflow-hidden p-1 shadow-inner">
                            <div className="h-full bg-gradient-to-r from-vov-blue to-vov-red w-[75%] rounded-full shadow-lg" />
                          </div>
                          <p className="text-xs font-black text-vov-red mt-4 text-right uppercase tracking-widest">75% Hoàn thành</p>
                        </div>
                        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                          <h4 className="font-black text-vov-blue uppercase tracking-widest text-xs mb-4">Điểm trung bình hệ 10</h4>
                          <div className="text-5xl font-serif font-black text-vov-blue">8.4 <span className="text-xl text-gray-300">/ 10</span></div>
                          <p className="text-[10px] font-bold text-gray-400 mt-4 uppercase tracking-widest">Dựa trên kết quả 3 bài kiểm tra</p>
                        </div>
                      </div>

                      <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                        <h4 className="font-black text-vov-blue uppercase tracking-widest text-xs mb-6">Chi tiết tiến độ từng sinh viên</h4>
                        <div className="space-y-4">
                          {reports.map((r, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-[24px] transition-all border border-transparent hover:border-gray-100">
                              <span className="font-bold text-vov-blue">{r.name}</span>
                              <div className="flex items-center gap-8">
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Điểm danh</p>
                                  <p className="font-black text-vov-blue">{r.attendance} buổi</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Điểm TB</p>
                                  <p className="font-black text-vov-red">{r.avg_quiz_score ? r.avg_quiz_score.toFixed(1) : 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Attendance Actions */}
                <div className="space-y-6">
                  <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-lg">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-2 text-vov-blue">
                      <CheckCircle size={24} className="text-vov-red" />
                      Điểm danh QR
                    </h3>
                    
                    {user?.role === 'lecturer' ? (
                      <div className="space-y-6">
                        {activeSession ? (
                          <div className="space-y-4">
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                              <span className="text-sm font-bold text-emerald-700">Phiên điểm danh đang mở</span>
                            </div>
                            <button 
                              onClick={() => setView('attendance')}
                              className="w-full bg-vov-blue text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-800 transition-all shadow-xl shadow-blue-100"
                            >
                              <QrCode size={20} />
                              Xem mã QR & DS
                            </button>
                            <button 
                              onClick={endAttendance}
                              className="w-full bg-white border-2 border-vov-red text-vov-red py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-red-50 transition-all"
                            >
                              Kết thúc sớm
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-gray-500 leading-relaxed">Tạo mã QR bảo mật để sinh viên quét và ghi nhận sự hiện diện trong tiết học.</p>
                            <button 
                              onClick={() => startAttendance(selectedCourse.id)}
                              className="w-full bg-vov-red text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-red-700 transition-all shadow-xl shadow-red-100"
                            >
                              <QrCode size={20} />
                              Bắt đầu điểm danh
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {activeSession ? (
                          <div className="p-4 bg-vov-red/5 border border-vov-red/10 rounded-2xl flex items-center gap-3 mb-2">
                            <Clock size={18} className="text-vov-red animate-spin-slow" />
                            <span className="text-sm font-bold text-vov-red">Giảng viên đang mở điểm danh!</span>
                          </div>
                        ) : null}
                        <p className="text-sm text-gray-500 leading-relaxed">Nhập mã điểm danh 6 ký tự được hiển thị trên màn hình giảng viên.</p>
                        <input 
                          id="qr-code-input"
                          placeholder="MÃ 6 KÝ TỰ"
                          className={`w-full px-4 py-4 rounded-2xl border-2 outline-none uppercase text-center font-black text-2xl tracking-[0.5em] text-vov-blue transition-all ${activeSession ? 'bg-white border-vov-red shadow-lg shadow-red-50' : 'bg-gray-50 border-gray-50 focus:bg-white focus:border-vov-blue'}`}
                        />
                        <button 
                          onClick={() => {
                            const input = document.getElementById('qr-code-input') as HTMLInputElement;
                            if (input.value) checkAttendance(input.value);
                          }}
                          disabled={loading}
                          className="w-full bg-vov-red text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-100 disabled:opacity-50"
                        >
                          {loading ? 'Đang xử lý...' : 'Xác nhận hiện diện'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-vov-blue text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
                    <h4 className="font-black mb-6 flex items-center gap-2 uppercase tracking-widest text-xs">
                      <Users size={18} className="text-vov-gold" /> Thống kê lớp học
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/10 p-4 rounded-[24px] backdrop-blur-sm">
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Sĩ số</p>
                        <p className="text-3xl font-black text-vov-gold">45</p>
                      </div>
                      <div className="bg-white/10 p-4 rounded-[24px] backdrop-blur-sm">
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Học liệu</p>
                        <p className="text-3xl font-black text-vov-gold">{materials.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between border-b-2 border-vov-red pb-4">
                <h2 className="text-3xl font-serif font-black text-vov-blue">Quản trị hệ thống</h2>
                <div className="flex gap-3">
                  <button className="bg-vov-red text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-100 hover:bg-red-700 transition-all">
                    <Plus size={16} /> Thêm người dùng
                  </button>
                  <button className="bg-white border border-gray-200 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-gray-50 transition-all">
                    <Upload size={16} /> Nhập dữ liệu CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                    <h3 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2"><Settings size={18} className="text-vov-red" /> Cấu hình</h3>
                    <nav className="space-y-2">
                      <button className="w-full text-left px-4 py-3 rounded-2xl bg-vov-blue/5 text-vov-blue font-black text-xs uppercase tracking-widest">Quản lý Người dùng</button>
                      <button className="w-full text-left px-4 py-3 rounded-2xl text-gray-400 hover:bg-gray-50 font-black text-xs uppercase tracking-widest transition-colors">Nhóm & Lớp học</button>
                      <button className="w-full text-left px-4 py-3 rounded-2xl text-gray-400 hover:bg-gray-50 font-black text-xs uppercase tracking-widest transition-colors">Thiết lập Hệ thống</button>
                      <button className="w-full text-left px-4 py-3 rounded-2xl text-gray-400 hover:bg-gray-50 font-black text-xs uppercase tracking-widest transition-colors">Tích hợp Zoom/Meet</button>
                    </nav>
                  </div>
                </div>

                <div className="lg:col-span-3 space-y-6">
                  <div className="bg-white rounded-[40px] border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black tracking-widest">
                        <tr>
                          <th className="px-8 py-5">Họ và tên</th>
                          <th className="px-8 py-5">Vai trò</th>
                          <th className="px-8 py-5">Đơn vị / Nhóm</th>
                          <th className="px-8 py-5">Ngày tham gia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {adminUsers.map(u => (
                          <tr key={u.id} className="hover:bg-vov-blue/5 transition-colors">
                            <td className="px-8 py-5 font-bold text-vov-blue">{u.name}</td>
                            <td className="px-8 py-5">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'lecturer' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-sm text-gray-500 font-medium">{u.group_name || 'Hệ thống'}</td>
                            <td className="px-8 py-5 text-[10px] text-gray-400 font-bold">{(u as any).created_at}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'attendance' && activeSession && (
            <motion.div 
              key="attendance"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-white p-12 rounded-[64px] shadow-2xl border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-4 bg-vov-red" />
                <div className="space-y-8 text-center md:text-left">
                  <button onClick={() => setView('course')} className="text-xs font-black text-gray-400 hover:text-vov-red flex items-center gap-2 uppercase tracking-widest transition-colors">
                    <ChevronRight size={16} className="rotate-180" /> Quay lại lớp học
                  </button>
                  <h2 className="text-5xl font-serif font-black text-vov-blue leading-tight">Quét mã để ghi nhận hiện diện</h2>
                  <p className="text-gray-500 font-medium">Mã QR này sẽ tự động hết hạn vào lúc: <span className="font-black text-vov-red">{new Date(activeSession.expiresAt).toLocaleTimeString()}</span></p>
                  
                  <div className="bg-vov-blue/5 p-8 rounded-[40px] inline-block border border-vov-blue/10">
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-[0.3em] mb-3">Mã dự phòng (Manual Code)</p>
                    <p className="text-6xl font-mono font-black tracking-tighter text-vov-blue">{activeSession.code}</p>
                  </div>

                  <div className="pt-8">
                    <button 
                      onClick={endAttendance}
                      className="bg-vov-red text-white px-12 py-4 rounded-full font-black uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all"
                    >
                      Kết thúc điểm danh
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center space-y-6">
                  <div className="p-8 bg-white rounded-[48px] shadow-2xl border-8 border-vov-blue/5">
                    {activeSession.code ? (
                      <QRCodeCanvas 
                        value={`${window.location.origin}?attendanceCode=${activeSession.code}`} 
                        size={280} 
                        level="H"
                        includeMargin={true}
                      />
                    ) : (
                      <div className="w-[280px] h-[280px] flex items-center justify-center text-vov-red font-bold">
                        Lỗi: Không có mã điểm danh
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-bold italic uppercase tracking-widest">Vui lòng sử dụng ứng dụng hoặc Zalo để quét mã</p>
                </div>
              </div>

              <div className="mt-16 space-y-8">
                <div className="flex items-center justify-between border-b-2 border-vov-blue pb-4">
                  <h3 className="text-3xl font-serif font-black text-vov-blue">Danh sách hiện diện ({attendanceRecords.length})</h3>
                  <div className="flex -space-x-3">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-gray-200 shadow-sm" />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  <AnimatePresence>
                    {attendanceRecords.map((record, idx) => (
                      <motion.div 
                        key={record.id || idx}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white px-8 py-5 rounded-[32px] border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-200" />
                        <span className="font-black text-vov-blue">{record.name}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {attendanceRecords.length === 0 && (
                    <div className="col-span-full text-center py-20 text-gray-400 italic bg-white rounded-[48px] border-4 border-dashed border-gray-100">
                      Hệ thống đang chờ sinh viên xác nhận hiện diện...
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
