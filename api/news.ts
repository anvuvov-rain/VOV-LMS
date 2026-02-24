import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Thay link dưới đây bằng trang tin tức chính thức của VOV College
    const { data } = await axios.get('https://vov.edu.vn/tin-tuc'); 
    const $ = cheerio.load(data);
    const articles: any[] = [];

    // Lấy 3 tin mới nhất (Cần điều chỉnh các thẻ HTML theo web trường)
    $('.news-item').each((i, el) => {
      if (i < 3) {
        articles.push({
          title: $(el).find('h3').text().trim(),
          date: $(el).find('.date').text().trim(),
          link: $(el).find('a').attr('href')
        });
      }
    });

    return res.status(200).json(articles);
  } catch (error) {
    return res.status(500).json({ error: 'Không thể lấy tin tức' });
  }
}
