const fs = require('fs');
const path = require('path');

// 加载命令索引数据
let commandIndex = {};
try {
  const dataJsonPath = path.join(process.cwd(), 'dist', 'data.json');
  const rawData = fs.readFileSync(dataJsonPath, 'utf8');
  commandIndex = JSON.parse(rawData);
} catch (err) {
  console.error('加载命令数据失败:', err.message);
}

// 命令详情缓存
const commandCache = {};

function getCommandMarkdown(cmdName) {
  if (commandCache[cmdName]) {
    return commandCache[cmdName];
  }
  
  const mdPath = path.join(process.cwd(), 'command', `${cmdName}.md`);
  try {
    if (fs.existsSync(mdPath)) {
      const content = fs.readFileSync(mdPath, 'utf8');
      commandCache[cmdName] = content;
      return content;
    }
  } catch (err) {
    console.error(`读取命令 ${cmdName} 失败:`, err.message);
  }
  return null;
}

// 计算搜索相关度
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
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const { url, method } = req;
  const parsedUrl = new URL(url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const query = Object.fromEntries(parsedUrl.searchParams);
  
  // /api/cmdlist - 获取所有命令列表
  if (pathname === '/api/cmdlist') {
    const cmdList = Object.values(commandIndex).map(cmd => ({
      name: cmd.n,
      description: cmd.d
    }));
    
    res.status(200).json({
      success: true,
      total: cmdList.length,
      data: cmdList
    });
    return;
  }
  
  // /api/cmd/search - 搜索命令
  if (pathname === '/api/cmd/search') {
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
    return;
  }
  
  // /api/cmd/detailed - 获取命令详情
  if (pathname === '/api/cmd/detailed') {
    const cmdName = (query.name || '').toLowerCase().trim();
    
    if (!cmdName) {
      res.status(400).json({ success: false, error: '缺少命令名称参数 name' });
      return;
    }
    
    if (!commandIndex[cmdName]) {
      res.status(404).json({
        success: false,
        error: `命令 "${cmdName}" 不存在`,
        suggestion: '请使用 /api/cmd/search 搜索相关命令'
      });
      return;
    }
    
    const mdContent = getCommandMarkdown(cmdName);
    
    // 直接返回 Markdown 原始内容
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.status(200).send(mdContent || '');
    return;
  }
  
  // 未知路由
  res.status(404).json({
    success: false,
    error: 'API 路由不存在',
    available: ['/api/cmdlist', '/api/cmd/search', '/api/cmd/detailed']
  });
};
