import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { data } = await axios.get('https://vov.edu.vn/tin-tuc', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(data);
    const articles: any[] = [];

    // Cấu hình mới nhất để lấy đúng tin từ vov.edu.vn
    $('.item, .post-item, .list-news-item').each((i, el) => {
      if (i < 3) {
        const title = $(el).find('h3, h4, .title').text().trim();
        const link = $(el).find('a').attr('href');
        const date = $(el).find('.date, .time').text().trim();
        
        if (title && link) {
          articles.push({
            title,
            link: link.startsWith('http') ? link : `https://vov.edu.vn${link}`,
            date: date || 'Mới cập nhật'
          });
        }
      }
    });

    return res.status(200).json(articles);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi lấy tin' });
  }
}
