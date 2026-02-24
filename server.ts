import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("vibecheck.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('admin', 'lecturer', 'student')),
    name TEXT,
    group_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(group_id) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    lecturer_id INTEGER,
    FOREIGN KEY(lecturer_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attendance_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    code TEXT UNIQUE,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY(course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    student_id INTEGER,
    device_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, student_id),
    UNIQUE(session_id, device_id),
    FOREIGN KEY(session_id) REFERENCES attendance_sessions(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    title TEXT,
    content TEXT,
    summary TEXT,
    type TEXT DEFAULT 'document', -- document, video, audio
    file_url TEXT,
    FOREIGN KEY(course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS presentation_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER,
    title TEXT,
    url TEXT,
    type TEXT, -- clip, illustration, etc.
    FOREIGN KEY(material_id) REFERENCES materials(id)
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    title TEXT,
    description TEXT,
    time_limit_minutes INTEGER,
    FOREIGN KEY(course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER,
    question_text TEXT,
    type TEXT DEFAULT 'multiple_choice', -- multiple_choice, true_false
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
  );

  CREATE TABLE IF NOT EXISTS options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER,
    option_text TEXT,
    is_correct INTEGER DEFAULT 0,
    FOREIGN KEY(question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS quiz_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER,
    student_id INTEGER,
    score REAL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    title TEXT,
    description TEXT,
    due_date DATETIME,
    FOREIGN KEY(course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS assignment_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER,
    student_id INTEGER,
    file_url TEXT,
    content TEXT,
    grade REAL,
    feedback TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assignment_id) REFERENCES assignments(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER, -- NULL for system-wide
    title TEXT,
    content TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(course_id) REFERENCES courses(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS forum_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    user_id INTEGER,
    title TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(course_id) REFERENCES courses(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    student_id INTEGER,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    certificate_code TEXT UNIQUE,
    FOREIGN KEY(course_id) REFERENCES courses(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    student_id INTEGER,
    UNIQUE(course_id, student_id),
    FOREIGN KEY(course_id) REFERENCES courses(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  );
`);

// Seed initial data if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO groups (name) VALUES (?)").run("K65 - Công nghệ thông tin");
  db.prepare("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)").run("admin", "admin", "admin", "Quản trị viên");
  db.prepare("INSERT INTO users (username, password, role, name, group_id) VALUES (?, ?, ?, ?, ?)").run("gv1", "123", "lecturer", "Giảng viên A", 1);
  db.prepare("INSERT INTO users (username, password, role, name, group_id) VALUES (?, ?, ?, ?, ?)").run("sv1", "123", "student", "Sinh viên B", 1);
  db.prepare("INSERT INTO users (username, password, role, name, group_id) VALUES (?, ?, ?, ?, ?)").run("sv2", "123", "student", "Sinh viên C", 1);
  db.prepare("INSERT INTO courses (name, lecturer_id) VALUES (?, ?)").run("Lập trình Web", 2);
  db.prepare("INSERT INTO enrollments (course_id, student_id) VALUES (?, ?)").run(1, 3);
  db.prepare("INSERT INTO enrollments (course_id, student_id) VALUES (?, ?)").run(1, 4);

  // Seed Quizzes
  db.prepare("INSERT INTO quizzes (course_id, title, description, time_limit_minutes) VALUES (?, ?, ?, ?)").run(1, "Kiểm tra kiến thức HTML/CSS", "Bài trắc nghiệm cơ bản về cấu trúc web", 15);
  db.prepare("INSERT INTO questions (quiz_id, question_text, type) VALUES (?, ?, ?)").run(1, "Thẻ nào dùng để tạo liên kết?", "multiple_choice");
  db.prepare("INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)").run(1, "<a>", 1);
  db.prepare("INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)").run(1, "<div>", 0);

  // Seed Assignments
  db.prepare("INSERT INTO assignments (course_id, title, description, due_date) VALUES (?, ?, ?, ?)").run(1, "Xây dựng Landing Page cá nhân", "Sử dụng HTML/CSS để tạo một trang web giới thiệu bản thân", "2026-03-01");

  // Seed Announcements
  db.prepare("INSERT INTO announcements (course_id, title, content, created_by) VALUES (?, ?, ?, ?)").run(1, "Thông báo nghỉ học", "Lớp nghỉ học vào thứ 2 tuần tới do giảng viên đi công tác.", 2);
}

import * as cheerio from "cheerio";
import { google } from "googleapis";

// Google Sheets Helper
async function appendToGoogleSheet(data: any[]) {
  const authEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const authKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!authEmail || !authKey || !sheetId) {
    console.warn("Google Sheets configuration missing. Skipping sync.");
    return;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: authEmail,
        private_key: authKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:E', // Adjust range as needed
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [data],
      },
    });
    console.log("Synced to Google Sheets successfully.");
  } catch (error) {
    console.error("Error syncing to Google Sheets:", error);
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(express.json());

  // Auth API
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Courses API
  app.get("/api/news/scrape", async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      // Return mock data if no URL provided
      return res.json([
        { title: 'Lễ tốt nghiệp khóa 2021-2024', date: '20/02/2026', img: 'grad' },
        { title: 'Thông báo tuyển sinh Cao đẳng chính quy 2026', date: '15/02/2026', img: 'enroll' },
        { title: 'Hội thảo Kỹ thuật Truyền hình 4K', date: '10/02/2026', img: 'tech' }
      ]);
    }

    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      const news: any[] = [];

      // This is a generic scraper, might need adjustment based on actual site structure
      // We'll try to find common patterns for news lists
      $('article, .news-item, .post-item').slice(0, 3).each((i, el) => {
        const title = $(el).find('h2, h3, .title').text().trim();
        const date = $(el).find('.date, time').text().trim() || new Date().toLocaleDateString();
        const img = $(el).find('img').attr('src') || `news-${i}`;
        if (title) {
          news.push({ title, date, img });
        }
      });

      // If generic failed, try another common pattern
      if (news.length === 0) {
        $('a').each((i, el) => {
          const title = $(el).text().trim();
          if (title.length > 20 && news.length < 3) {
            news.push({ title, date: new Date().toLocaleDateString(), img: `news-${i}` });
          }
        });
      }

      res.json(news.length > 0 ? news : [
        { title: 'Không tìm thấy bài viết mới', date: '-', img: 'none' }
      ]);
    } catch (error) {
      res.status(500).json({ error: "Lỗi khi cào dữ liệu" });
    }
  });

  app.get("/api/courses", (req, res) => {
    const { userId, role } = req.query;
    if (role === 'lecturer') {
      const courses = db.prepare("SELECT * FROM courses WHERE lecturer_id = ?").all(userId);
      res.json(courses);
    } else {
      // For students, show courses they are enrolled in
      const courses = db.prepare(`
        SELECT c.* FROM courses c
        JOIN enrollments e ON c.id = e.course_id
        WHERE e.student_id = ?
      `).all(userId);
      res.json(courses);
    }
  });

  app.get("/api/courses/available", (req, res) => {
    const { userId } = req.query;
    const courses = db.prepare(`
      SELECT * FROM courses 
      WHERE id NOT IN (SELECT course_id FROM enrollments WHERE student_id = ?)
    `).all(userId);
    res.json(courses);
  });

  app.post("/api/courses/enroll", async (req, res) => {
    const { userId, courseId } = req.body;
    try {
      db.prepare("INSERT INTO enrollments (course_id, student_id) VALUES (?, ?)").run(courseId, userId);
      
      // Fetch details for Google Sheets
      const student = db.prepare("SELECT name, username FROM users WHERE id = ?").get(userId) as any;
      const course = db.prepare("SELECT name FROM courses WHERE id = ?").get(courseId) as any;
      const timestamp = new Date().toLocaleString('vi-VN');

      // Sync to Google Sheets: [Timestamp, Student Name, Username, Course Name, Action]
      await appendToGoogleSheet([timestamp, student.name, student.username, course.name, "Đăng ký lớp"]);

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Bạn đã đăng ký lớp này rồi" });
    }
  });

  // Attendance API
  app.post("/api/attendance/session", (req, res) => {
    const { courseId, durationMinutes } = req.body;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();
    
    const result = db.prepare("INSERT INTO attendance_sessions (course_id, code, expires_at) VALUES (?, ?, ?)").run(courseId, code, expiresAt);
    res.json({ id: result.lastInsertRowid, code, expiresAt });
  });

  app.get("/api/attendance/active/:courseId", (req, res) => {
    const session = db.prepare("SELECT * FROM attendance_sessions WHERE course_id = ? AND is_active = 1 AND expires_at > ?").get(req.params.courseId, new Date().toISOString()) as any;
    if (session) {
      res.json({ id: session.id, code: session.code, expiresAt: session.expires_at });
    } else {
      res.json(null);
    }
  });

  app.post("/api/attendance/end/:sessionId", (req, res) => {
    db.prepare("UPDATE attendance_sessions SET is_active = 0 WHERE id = ?").run(req.params.sessionId);
    res.json({ success: true });
  });

  app.post("/api/attendance/check", (req, res) => {
    const { code, studentId, deviceId } = req.body;
    const session = db.prepare("SELECT * FROM attendance_sessions WHERE code = ? AND is_active = 1").get(code) as any;
    
    if (!session) return res.status(404).json({ error: "Phiên không tồn tại" });
    if (new Date(session.expires_at) < new Date()) return res.status(400).json({ error: "Phiên đã hết hạn" });

    try {
      db.prepare("INSERT INTO attendance_records (session_id, student_id, device_id) VALUES (?, ?, ?)").run(session.id, studentId, deviceId);
      const student = db.prepare("SELECT name FROM users WHERE id = ?").get(studentId) as any;
      io.to(`session-${session.id}`).emit("new-attendance", { studentId, name: student.name });
      res.json({ success: true });
    } catch (e: any) {
      if (e.message.includes('UNIQUE constraint failed: attendance_records.session_id, attendance_records.device_id')) {
        res.status(400).json({ error: "Thiết bị này đã được sử dụng để điểm danh cho sinh viên khác" });
      } else {
        res.status(400).json({ error: "Bạn đã điểm danh rồi" });
      }
    }
  });

  app.get("/api/attendance/records/:sessionId", (req, res) => {
    const records = db.prepare(`
      SELECT u.id, u.name, r.timestamp 
      FROM attendance_records r 
      JOIN users u ON r.student_id = u.id 
      WHERE r.session_id = ?
    `).all(req.params.sessionId);
    res.json(records);
  });

  app.get("/api/courses/:courseId/students", (req, res) => {
    const students = db.prepare(`
      SELECT u.id, u.name, u.username, 
      (SELECT COUNT(*) FROM attendance_records ar 
       JOIN attendance_sessions asess ON ar.session_id = asess.id 
       WHERE ar.student_id = u.id AND asess.course_id = ?) as attendance_count
      FROM users u
      JOIN enrollments e ON u.id = e.student_id
      WHERE e.course_id = ?
    `).all(req.params.courseId, req.params.courseId);
    res.json(students);
  });

  // User Management (Admin)
  app.get("/api/admin/users", (req, res) => {
    const users = db.prepare("SELECT u.*, g.name as group_name FROM users u LEFT JOIN groups g ON u.group_id = g.id").all();
    res.json(users);
  });

  app.post("/api/admin/users", (req, res) => {
    const { username, password, role, name, group_id } = req.body;
    const result = db.prepare("INSERT INTO users (username, password, role, name, group_id) VALUES (?, ?, ?, ?, ?)").run(username, password, role, name, group_id);
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/admin/groups", (req, res) => {
    const groups = db.prepare("SELECT * FROM groups").all();
    res.json(groups);
  });

  // Quizzes API
  app.get("/api/courses/:courseId/quizzes", (req, res) => {
    const quizzes = db.prepare("SELECT * FROM quizzes WHERE course_id = ?").all(req.params.courseId);
    res.json(quizzes);
  });

  app.post("/api/quizzes", (req, res) => {
    const { courseId, title, description, timeLimit } = req.body;
    const result = db.prepare("INSERT INTO quizzes (course_id, title, description, time_limit_minutes) VALUES (?, ?, ?, ?)").run(courseId, title, description, timeLimit);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/quizzes/full", (req, res) => {
    const { courseId, title, description, timeLimit, questions } = req.body;
    
    db.transaction(() => {
      const quizResult = db.prepare("INSERT INTO quizzes (course_id, title, description, time_limit_minutes) VALUES (?, ?, ?, ?)").run(courseId, title, description, timeLimit);
      const quizId = quizResult.lastInsertRowid;

      questions.forEach((q: any) => {
        const qResult = db.prepare("INSERT INTO questions (quiz_id, question_text, type) VALUES (?, ?, ?)").run(quizId, q.question_text, q.type || 'multiple_choice');
        const questionId = qResult.lastInsertRowid;

        q.options.forEach((opt: any) => {
          db.prepare("INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)").run(questionId, opt.option_text, opt.is_correct ? 1 : 0);
        });
      });
    })();

    res.json({ success: true });
  });

  app.get("/api/quizzes/:quizId/questions", (req, res) => {
    const questions = db.prepare("SELECT * FROM questions WHERE quiz_id = ?").all(req.params.quizId);
    const questionsWithChoices = questions.map((q: any) => {
      const options = db.prepare("SELECT * FROM options WHERE question_id = ?").all(q.id);
      return { ...q, options };
    });
    res.json(questionsWithChoices);
  });

  app.get("/api/quizzes/:quizId/submissions/:studentId", (req, res) => {
    const submission = db.prepare("SELECT * FROM quiz_submissions WHERE quiz_id = ? AND student_id = ?").get(req.params.quizId, req.params.studentId);
    res.json(submission || null);
  });

  app.post("/api/quizzes/:quizId/submit", (req, res) => {
    const { studentId, answers } = req.body; // answers: { questionId: optionId }
    const quizId = req.params.quizId;

    const questions = db.prepare("SELECT * FROM questions WHERE quiz_id = ?").all(quizId);
    let correctCount = 0;

    questions.forEach((q: any) => {
      const correctOption = db.prepare("SELECT id FROM options WHERE question_id = ? AND is_correct = 1").get(q.id) as any;
      if (correctOption && answers[q.id] == correctOption.id) {
        correctCount++;
      }
    });

    const score = (correctCount / questions.length) * 10;
    
    try {
      db.prepare("INSERT INTO quiz_submissions (quiz_id, student_id, score) VALUES (?, ?, ?)").run(quizId, studentId, score);
      res.json({ success: true, score });
    } catch (e) {
      res.status(400).json({ error: "Bạn đã nộp bài thi này rồi" });
    }
  });

  // Assignments API
  app.get("/api/courses/:courseId/assignments", (req, res) => {
    const assignments = db.prepare("SELECT * FROM assignments WHERE course_id = ?").all(req.params.courseId);
    res.json(assignments);
  });

  app.post("/api/assignments", (req, res) => {
    const { courseId, title, description, dueDate } = req.body;
    const result = db.prepare("INSERT INTO assignments (course_id, title, description, due_date) VALUES (?, ?, ?, ?)").run(courseId, title, description, dueDate);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/assignments/:assignmentId/submit", (req, res) => {
    const { studentId, content, fileUrl } = req.body;
    const result = db.prepare("INSERT INTO assignment_submissions (assignment_id, student_id, content, file_url) VALUES (?, ?, ?, ?)").run(req.params.assignmentId, studentId, content, fileUrl);
    res.json({ id: result.lastInsertRowid });
  });

  // Announcements API
  app.get("/api/announcements", (req, res) => {
    const { courseId } = req.query;
    let announcements;
    if (courseId) {
      announcements = db.prepare("SELECT a.*, u.name as creator_name FROM announcements a JOIN users u ON a.created_by = u.id WHERE course_id = ? OR course_id IS NULL ORDER BY created_at DESC").all(courseId);
    } else {
      announcements = db.prepare("SELECT a.*, u.name as creator_name FROM announcements a JOIN users u ON a.created_by = u.id WHERE course_id IS NULL ORDER BY created_at DESC").all();
    }
    res.json(announcements);
  });

  app.post("/api/announcements", (req, res) => {
    const { courseId, title, content, userId } = req.body;
    const result = db.prepare("INSERT INTO announcements (course_id, title, content, created_by) VALUES (?, ?, ?, ?)").run(courseId, title, content, userId);
    res.json({ id: result.lastInsertRowid });
  });

  // Reporting API
  app.get("/api/reports/progress/:courseId", (req, res) => {
    const progress = db.prepare(`
      SELECT u.name, 
      (SELECT COUNT(*) FROM attendance_records ar JOIN attendance_sessions asess ON ar.session_id = asess.id WHERE ar.student_id = u.id AND asess.course_id = ?) as attendance,
      (SELECT AVG(score) FROM quiz_submissions qs JOIN quizzes q ON qs.quiz_id = q.id WHERE qs.student_id = u.id AND q.course_id = ?) as avg_quiz_score
      FROM users u
      JOIN enrollments e ON u.id = e.student_id
      WHERE e.course_id = ?
    `).all(req.params.courseId, req.params.courseId, req.params.courseId);
    res.json(progress);
  });

  // Materials API
  app.get("/api/materials/:courseId", (req, res) => {
    const materials = db.prepare("SELECT * FROM materials WHERE course_id = ?").all(req.params.courseId);
    res.json(materials);
  });

  app.post("/api/materials", (req, res) => {
    const { courseId, title, content, summary, type, file_url } = req.body;
    const result = db.prepare("INSERT INTO materials (course_id, title, content, summary, type, file_url) VALUES (?, ?, ?, ?, ?, ?)").run(courseId, title, content, summary, type || 'document', file_url);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/materials/:id", (req, res) => {
    db.prepare("DELETE FROM materials WHERE id = ?").run(req.params.id);
    db.prepare("DELETE FROM presentation_resources WHERE material_id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/materials/:materialId/resources", (req, res) => {
    const resources = db.prepare("SELECT * FROM presentation_resources WHERE material_id = ?").all(req.params.materialId);
    res.json(resources);
  });

  app.post("/api/materials/:materialId/resources", (req, res) => {
    const { title, url, type } = req.body;
    const result = db.prepare("INSERT INTO presentation_resources (material_id, title, url, type) VALUES (?, ?, ?, ?)").run(req.params.materialId, title, url, type);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/materials/resources/:id", (req, res) => {
    db.prepare("DELETE FROM presentation_resources WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Socket.io
  io.on("connection", (socket) => {
    socket.on("join-session", (sessionId) => {
      socket.join(`session-${sessionId}`);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
