const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DEPLOY_DIR = path.join(__dirname, '.deploy');
const DIST_DIR = path.join(__dirname, 'dist');
const COMMAND_DIR = path.join(__dirname, 'command');

// 加载命令索引数据
let commandIndex = {};
try {
  const dataJsonPath = path.join(DIST_DIR, 'data.json');
  const rawData = fs.readFileSync(dataJsonPath, 'utf8');
  commandIndex = JSON.parse(rawData);
  console.log(`✅ 已加载 ${Object.keys(commandIndex).length} 个命令`);
} catch (err) {
  console.error('❌ 加载命令数据失败:', err.message);
}

// 命令详情缓存
const commandCache = {};

function getCommandMarkdown(cmdName) {
  if (commandCache[cmdName]) {
    return commandCache[cmdName];
  }
  
  const mdPath = path.join(COMMAND_DIR, `${cmdName}.md`);
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

// 解析 Markdown 为结构化数据
function parseMarkdownToStructured(mdContent, cmdName) {
  if (!mdContent) return null;
  
  const lines = mdContent.split('\n');
  const result = {
    name: cmdName,
    description: '',
    syntax: '',
    options: [],
    examples: [],
    notes: [],
    rawMarkdown: mdContent
  };
  
  let currentSection = '';
  let currentOption = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (i === 2 && line && !line.startsWith('#')) {
      result.description = line;
    }
    
    if (line.includes('###  语法') || line.includes('### 语法')) {
      currentSection = 'syntax';
      continue;
    }
    
    if (currentSection === 'syntax' && line.startsWith('```')) continue;
    if (currentSection === 'syntax' && line && !line.startsWith('```') && !line.startsWith('#')) {
      result.syntax += line + '\n';
    }
    
    if (line.includes('###  选项') || line.includes('### 选项')) {
      currentSection = 'options';
      continue;
    }
    
    if (currentSection === 'options') {
      if (line.startsWith('```')) continue;
      if (line.match(/^[-#]\s+/) || line.match(/^[a-zA-Z]/)) {
        if (currentOption) result.options.push(currentOption);
        currentOption = { text: line, description: '' };
      } else if (currentOption && line) {
        currentOption.description += line + ' ';
      }
    }
    
    if (line.includes('###  示例') || line.includes('### 示例') || line.includes('### 实例')) {
      currentSection = 'examples';
      continue;
    }
    
    if (currentSection === 'examples') {
      if (line.startsWith('```shell') || line.startsWith('```bash')) {
        let example = '';
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          example += lines[i] + '\n';
          i++;
        }
        result.examples.push(example.trim());
      }
    }
    
    if (line.includes('## 补充说明')) {
      currentSection = 'notes';
      continue;
    }
    
    if (currentSection === 'notes' && line && !line.startsWith('#')) {
      result.notes.push(line);
    }
  }
  
  if (currentOption) result.options.push(currentOption);
  result.syntax = result.syntax.trim();
  
  return result;
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

// MIME 类型映射
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// 处理静态文件请求
function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// API 路由处理
function handleAPI(req, res, pathname, query) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return true;
  }
  
  // /api/cmdlist - 获取所有命令列表
  if (pathname === '/api/cmdlist') {
    const cmdList = Object.values(commandIndex).map(cmd => ({
      name: cmd.n,
      description: cmd.d
    }));
    
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      total: cmdList.length,
      data: cmdList
    }, null, 2));
    return true;
  }
  
  // /api/cmd/search - 搜索命令
  if (pathname === '/api/cmd/search') {
    const queryString = (query.q || '').toLowerCase().trim();
    
    if (!queryString) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: '缺少搜索参数 q' }));
      return true;
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
    
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      query: queryString,
      keywords: keywords,
      total: results.length,
      data: results
    }, null, 2));
    return true;
  }
  
  // /api/cmd/detailed - 获取命令详情
  if (pathname === '/api/cmd/detailed') {
    const cmdName = (query.name || '').toLowerCase().trim();
    
    if (!cmdName) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: '缺少命令名称参数 name' }));
      return true;
    }
    
    if (!commandIndex[cmdName]) {
      res.writeHead(404);
      res.end(JSON.stringify({
        success: false,
        error: `命令 "${cmdName}" 不存在`,
        suggestion: '请使用 /api/cmd/search 搜索相关命令'
      }));
      return true;
    }
    
    const mdContent = getCommandMarkdown(cmdName);
    
    // 直接返回 Markdown 原始内容
    res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
    res.end(mdContent || '');
    return true;
  }
  
  return false; // 不是 API 路由
}

// 创建服务器
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  
  // 优先处理 API 请求
  if (pathname.startsWith('/api/')) {
    if (handleAPI(req, res, pathname, query)) {
      return;
    }
  }
  
  // 处理静态文件
  let filePath = path.join(DEPLOY_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // 支持无 .html 后缀的 URL
  if (!path.extname(filePath)) {
    const candidate = filePath + '.html';
    if (fs.existsSync(candidate)) {
      filePath = candidate;
    }
  }
  
  serveStaticFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`\n🚀 Linux Command 服务器已启动`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`\n🌐 Web 界面:`);
  console.log(`   http://localhost:${PORT}/`);
  console.log(`\n🤖 AI Agent API:`);
  console.log(`   GET http://localhost:${PORT}/api/cmdlist`);
  console.log(`   GET http://localhost:${PORT}/api/cmd/search?q=关键词`);
  console.log(`   GET http://localhost:${PORT}/api/cmd/detailed?name=命令名`);
  console.log(`\n✨ 静态网站和 API 服务已融合`);
});
