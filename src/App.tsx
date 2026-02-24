import React from 'react';

function App() {
  return (
    <div className="lms-container">
      {/* Header */}
      <header className="header">
        <div className="logo">VOV LMS</div>
        <nav>
          <span>Trang chủ</span>
          <span>Tin tức</span>
          <span>Thông báo</span>
          <span className="user-info">Giảng viên A</span>
        </nav>
      </header>

      {/* Banner & Quote */}
      <section className="banner">
        <div className="quote-box">
          <p>"Chúng ta là những gì chúng ta liên tục làm. Do đó, xuất sắc không phải là một hành động, mà là một thói quen - Kiên trì với những công việc nhỏ, bạn sẽ trở thành người xuất sắc."</p>
        </div>
      </section>

      {/* Main Content */}
      <main className="content">
        <h3>Học phần của tôi</h3>
        <div className="course-grid">
          <div className="course-card active">
            <div className="badge">ĐANG DIỄN RA</div>
            <h4>Lập trình Web</h4>
            <button>Vào lớp học</button>
          </div>
          <div className="course-card add-new">
            <span>+ ĐĂNG KÝ LỚP MỚI</span>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="footer">
        <p>Hotline: 0917167777 | Email: phamanhvu@vov.edu.vn</p>
      </footer>
    </div>
  );
}

export default App;
