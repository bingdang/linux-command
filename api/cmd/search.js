const fs = require('fs');
const path = require('path');

let commandIndex = {};
try {
  const dataJsonPath = path.join(process.cwd(), 'dist', 'data.json');
  const rawData = fs.readFileSync(dataJsonPath, 'utf8');
  commandIndex = JSON.parse(rawData);
} catch (err) {
  console.error('加载命令数据失败:', err.message);
}

function calculateRelevance(cmd, keywords) {
  let score = 0;
  const cmdName = cmd.n.toLowerCase();
  const cmdDesc = (cmd.d || '').toLowerCase();
  
  keywords.forEach(keyword => {
    if (cmdName === keyword) score += 100;
    else if (cmdName.includes(keyword)) score += 50;
    if (cmdDesc.includes(keyword)) score += 20;
  });
  
  return score;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const { url } = req;
  const parsedUrl = new URL(url, `http://${req.headers.host}`);
  const query = Object.fromEntries(parsedUrl.searchParams);
  const queryString = (query.q || '').toLowerCase().trim();
  
  if (!queryString) {
    res.status(400).json({ success: false, error: '缺少搜索参数 q' });
    return;
  }
  
  const keywords = queryString.split(/\s+/).filter(k => k.length > 0);
  const results = Object.values(commandIndex)
    .map(cmd => ({ ...cmd, relevance: calculateRelevance(cmd, keywords) }))
    .filter(cmd => cmd.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 20)
    .map(cmd => ({
      name: cmd.n,
      description: cmd.d,
      relevance: cmd.relevance
    }));
  
  res.status(200).json({
    success: true,
    query: queryString,
    keywords: keywords,
    total: results.length,
    data: results
  });
};
