const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 读取命令索引数据
const dataJsonPath = path.join(__dirname, 'dist', 'data.json');
let commandIndex = {};

try {
  const rawData = fs.readFileSync(dataJsonPath, 'utf8');
  commandIndex = JSON.parse(rawData);
  console.log(`✅ 已加载 ${Object.keys(commandIndex).length} 个命令`);
} catch (err) {
  console.error('❌ 加载命令数据失败:', err.message);
  process.exit(1);
}

// 读取命令 Markdown 文件缓存
const commandCache = {};

function getCommandMarkdown(cmdName) {
  if (commandCache[cmdName]) {
    return commandCache[cmdName];
  }
  
  const mdPath = path.join(__dirname, 'command', `${cmdName}.md`);
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

// 解析 Markdown 内容为结构化数据
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
    
    // 提取描述（标题后的第一段）
    if (i === 2 && line && !line.startsWith('#')) {
      result.description = line;
    }
    
    // 提取语法
    if (line.includes('###  语法') || line.includes('### 语法')) {
      currentSection = 'syntax';
      continue;
    }
    
    if (currentSection === 'syntax' && line.startsWith('```')) {
      // 跳过代码块标记
      continue;
    }
    
    if (currentSection === 'syntax' && line && !line.startsWith('```') && !line.startsWith('#')) {
      result.syntax += line + '\n';
    }
    
    // 提取选项
    if (line.includes('###  选项') || line.includes('### 选项')) {
      currentSection = 'options';
      continue;
    }
    
    if (currentSection === 'options') {
      if (line.startsWith('```')) {
        continue;
      }
      if (line.match(/^[-#]\s+/) || line.match(/^[a-zA-Z]/)) {
        if (currentOption) {
          result.options.push(currentOption);
        }
        currentOption = { text: line, description: '' };
      } else if (currentOption && line) {
        currentOption.description += line + ' ';
      }
    }
    
    // 提取示例
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
    
    // 提取补充说明
    if (line.includes('## 补充说明')) {
      currentSection = 'notes';
      continue;
    }
    
    if (currentSection === 'notes' && line && !line.startsWith('#')) {
      result.notes.push(line);
    }
  }
  
  // 添加最后一个选项
  if (currentOption) {
    result.options.push(currentOption);
  }
  
  // 清理语法字段
  result.syntax = result.syntax.trim();
  
  return result;
}

// 计算搜索相关度
function calculateRelevance(cmd, keywords) {
  let score = 0;
  const cmdName = cmd.n.toLowerCase();
  const cmdDesc = (cmd.d || '').toLowerCase();
  
  keywords.forEach(keyword => {
    // 命令名完全匹配
    if (cmdName === keyword) {
      score += 100;
    }
    // 命令名包含关键词
    else if (cmdName.includes(keyword)) {
      score += 50;
    }
    // 描述包含关键词
    if (cmdDesc.includes(keyword)) {
      score += 20;
    }
  });
  
  return score;
}

// API 路由处理
function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // 路由：/api/cmdlist - 获取所有命令列表
  if (pathname === '/api/cmdlist') {
    const cmdList = Object.values(commandIndex).map(cmd => ({
      name: cmd.n,
      description: cmd.d,
      path: cmd.p
    }));
    
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      total: cmdList.length,
      data: cmdList
    }, null, 2));
    return;
  }
  
  // 路由：/api/cmd/search - 搜索命令
  if (pathname === '/api/cmd/search') {
    const query = (parsedUrl.query.q || '').toLowerCase().trim();
    
    if (!query) {
      res.writeHead(400);
      res.end(JSON.stringify({
        success: false,
        error: '缺少搜索参数 q'
      }));
      return;
    }
    
    const keywords = query.split(/\s+/).filter(k => k.length > 0);
    
    // 搜索并计算相关度
    const results = Object.values(commandIndex)
      .map(cmd => ({
        ...cmd,
        relevance: calculateRelevance(cmd, keywords)
      }))
      .filter(cmd => cmd.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 20) // 返回前20个结果
      .map(cmd => ({
        name: cmd.n,
        description: cmd.d,
        path: cmd.p,
        relevance: cmd.relevance
      }));
    
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      query: query,
      keywords: keywords,
      total: results.length,
      data: results
    }, null, 2));
    return;
  }
  
  // 路由：/api/cmd/detailed - 获取命令详情
  if (pathname === '/api/cmd/detailed') {
    const cmdName = (parsedUrl.query.name || '').toLowerCase().trim();
    
    if (!cmdName) {
      res.writeHead(400);
      res.end(JSON.stringify({
        success: false,
        error: '缺少命令名称参数 name'
      }));
      return;
    }
    
    // 检查命令是否存在
    if (!commandIndex[cmdName]) {
      res.writeHead(404);
      res.end(JSON.stringify({
        success: false,
        error: `命令 "${cmdName}" 不存在`,
        suggestion: '请使用 /api/cmd/search 搜索相关命令'
      }));
      return;
    }
    
    // 读取并解析 Markdown
    const mdContent = getCommandMarkdown(cmdName);
    const structured = parseMarkdownToStructured(mdContent, cmdName);
    
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      data: structured || {
        name: cmdName,
        description: commandIndex[cmdName].d,
        rawMarkdown: mdContent
      }
    }, null, 2));
    return;
  }
  
  // 404 - 路由不存在
  res.writeHead(404);
  res.end(JSON.stringify({
    success: false,
    error: 'API 路由不存在',
    availableRoutes: [
      '/api/cmdlist',
      '/api/cmd/search?q=关键词',
      '/api/cmd/detailed?name=命令名'
    ]
  }));
}

// 创建服务器
const PORT = process.env.PORT || 3001;
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`🚀 AI Agent API 服务器已启动`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`📚 API 文档:`);
  console.log(`   GET http://localhost:${PORT}/api/cmdlist`);
  console.log(`   GET http://localhost:${PORT}/api/cmd/search?q=关键词`);
  console.log(`   GET http://localhost:${PORT}/api/cmd/detailed?name=命令名`);
});
