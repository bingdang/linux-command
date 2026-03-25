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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const cmdList = Object.values(commandIndex).map(cmd => ({
    name: cmd.n,
    description: cmd.d
  }));
  
  res.status(200).json({
    success: true,
    total: cmdList.length,
    data: cmdList
  });
};
