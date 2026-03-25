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
  
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.status(200).send(mdContent || '');
};
