import React, { useEffect, useState } from 'react';

function App() {
  const [news, setNews] = useState([]);

  // Tự động gọi "nhân viên cào tin" khi mở trang
  useEffect(() => {
    fetch('/api/news')
      .then(res => res.json())
      .then(data => setNews(data))
      .catch(err => console.error("Lỗi lấy tin:", err));
  }, []);

  return (
    <div className="lms-container">
      {/* Header với Link thật */}
      <header className="header">
        <div className="logo">VOV LMS</div>
        <nav>
          <a href="/">Trang chủ</a>
          <a href="#tintuc">Tin tức</a>
          <a href="#thongbao">Thông báo</a>
          <span className="user-info">Giảng viên A</span>
        </nav>
      </header>

      <section className="banner" style={{backgroundImage: "url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e')"}}>
        <div className="quote-box">
          <p>"Chúng ta là những gì chúng ta liên tục làm. Do đó, xuất sắc không phải là một hành động, mà là một thói quen..."</p>
        </div>
      </section>

      <div className="main-layout" style={{display: 'flex', gap: '20px', padding: '20px'}}>
        {/* Cột trái: Học phần */}
        <main className="content" style={{flex: 2}}>
          <h3>Học phần của tôi</h3>
          <div className="course-grid" style={{display: 'flex', gap: '15px'}}>
            <div className="course-card">
              <div className="badge">ĐANG DIỄN RA</div>
              <h4>Lập trình Web</h4>
              <a href="/course/web" className="btn">Vào lớp học</a>
            </div>
            <div className="course-card add-new">
              <a href="#register">+ ĐĂNG KÝ LỚP MỚI</a>
            </div>
          </div>
        </main>

        {/* Cột phải: Tin tức tự động (Cào tin) */}
        <aside id="tintuc" className="news-sidebar" style={{flex: 1, background: 'white', padding: '15px', borderRadius: '10px'}}>
          <h3>Tin tức & Sự kiện</h3>
          {news.length > 0 ? news.map((item: any, index: number) => (
            <div key={index} className="news-item" style={{marginBottom: '15px', borderBottom: '1px solid #eee'}}>
              <a href={item.link} target="_blank" rel="noreferrer" style={{textDecoration: 'none', color: '#004a99', fontWeight: 'bold'}}>
                {item.title}
              </a>
              <p style={{fontSize: '12px', color: '#666'}}>{item.date}</p>
            </div>
          )) : <p>Đang tải tin tức từ trường...</p>}
        </aside>
      </div>

      <footer className="footer" style={{textAlign: 'center', padding: '20px', borderTop: '1px solid #ddd'}}>
        <p>Hotline: 0917167777 | Email: phamanhvu@vov.edu.vn</p>
      </footer>
    </div>
  );
}

export default App;
