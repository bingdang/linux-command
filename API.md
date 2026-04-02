# AI Agent API 文档

为 AI Agent 提供的 Linux 命令查询接口

## 🚀 快速启动

```bash
cd /data/linux-command
node api-server.js
```

服务器将在 `http://localhost:3001` 启动

## 📡 API 接口

### 1. GET /api/cmdlist - 获取所有命令列表

**用途**：AI Agent 获取系统支持的所有 Linux 命令

**请求示例**：
```bash
curl http://localhost:3001/api/cmdlist
```

**响应示例**：
```json
{
  "success": true,
  "total": 615,
  "data": [
    {
      "name": "ls",
      "description": "显示目录内容列表",
      "path": "/ls"
    },
    {
      "name": "grep",
      "description": "强大的文本搜索工具",
      "path": "/grep"
    }
  ]
}
```

**AI 使用场景**：
- 初始化时加载可用命令列表
- 命令自动补全
- 构建命令知识库索引

---

### 2. GET /api/cmd/search - 搜索命令

**用途**：根据关键词搜索相关命令

**参数**：
- `q` (必需): 搜索关键词，支持多关键词空格分隔

**请求示例**：
```bash
# 单关键词搜索
curl "http://localhost:3001/api/cmd/search?q=文件"

# 多关键词搜索
curl "http://localhost:3001/api/cmd/search?q=查找 删除 文件"
```

**响应示例**：
```json
{
  "success": true,
  "query": "查找 文件",
  "keywords": ["查找", "文件"],
  "total": 15,
  "data": [
    {
      "name": "find",
      "description": "在目录树中搜索文件",
      "path": "/find",
      "relevance": 120
    },
    {
      "name": "locate",
      "description": "快速查找文件",
      "path": "/locate",
      "relevance": 90
    }
  ]
}
```

**相关度评分规则**：
- 命令名完全匹配：+100 分
- 命令名包含关键词：+50 分
- 描述包含关键词：+20 分

**AI 使用场景**：
- 理解用户意图后搜索相关命令
- 提供命令建议
- 多命令对比推荐

---

### 3. GET /api/cmd/detailed - 获取命令详情

**用途**：获取指定命令的完整详细信息

**参数**：
- `name` (必需): 命令名称

**请求示例**：
```bash
curl "http://localhost:3001/api/cmd/detailed?name=ls"
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "name": "ls",
    "description": "显示目录内容列表",
    "syntax": "ls [选项] [文件名...]",
    "options": [
      {
        "text": "-a",
        "description": "列出所有文件，包括隐藏文件"
      },
      {
        "text": "-l",
        "description": "使用长格式列出文件信息"
      }
    ],
    "examples": [
      "ls -la /home",
      "ls -lh *.txt"
    ],
    "notes": [
      "ls命令是list的缩写",
      "输出信息可以进行彩色加亮显示"
    ],
    "rawMarkdown": "ls\n===\n\n显示目录内容列表..."
  }
}
```

**AI 使用场景**：
- 生成命令使用教程
- 解释参数含义
- 提供使用示例
- 回答用户具体问题

---

## 🤖 AI Agent 使用示例

### Python 示例

```python
import requests

API_BASE = "http://localhost:3001"

# 1. 获取所有命令
def get_all_commands():
    response = requests.get(f"{API_BASE}/api/cmdlist")
    return response.json()

# 2. 搜索命令
def search_commands(query):
    response = requests.get(f"{API_BASE}/api/cmd/search", params={"q": query})
    return response.json()

# 3. 获取命令详情
def get_command_detail(cmd_name):
    response = requests.get(f"{API_BASE}/api/cmd/detailed", params={"name": cmd_name})
    return response.json()

# AI Agent 工作流示例
def ai_agent_workflow(user_query):
    # 步骤1: 搜索相关命令
    search_result = search_commands(user_query)
    
    if search_result['total'] == 0:
        return "抱歉，没有找到相关命令"
    
    # 步骤2: 获取最相关命令的详情
    top_cmd = search_result['data'][0]['name']
    detail = get_command_detail(top_cmd)
    
    # 步骤3: 生成回答
    cmd_info = detail['data']
    response = f"""
推荐使用命令: {cmd_info['name']}
描述: {cmd_info['description']}

语法: {cmd_info['syntax']}

常用参数:
"""
    for opt in cmd_info['options'][:5]:
        response += f"  {opt['text']}: {opt['description']}\n"
    
    if cmd_info['examples']:
        response += "\n示例:\n"
        for ex in cmd_info['examples'][:3]:
            response += f"  {ex}\n"
    
    return response

# 使用示例
user_question = "如何查找大文件"
print(ai_agent_workflow(user_question))
```

### JavaScript/Node.js 示例

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3001';

// AI Agent 类
class LinuxCommandAgent {
  // 搜索命令
  async searchCommands(query) {
    const response = await axios.get(`${API_BASE}/api/cmd/search`, {
      params: { q: query }
    });
    return response.data;
  }
  
  // 获取命令详情
  async getCommandDetail(cmdName) {
    const response = await axios.get(`${API_BASE}/api/cmd/detailed`, {
      params: { name: cmdName }
    });
    return response.data;
  }
  
  // AI 工作流：理解问题 -> 搜索 -> 获取详情 -> 生成回答
  async answerQuestion(userQuestion) {
    // 1. 搜索相关命令
    const searchResult = await this.searchCommands(userQuestion);
    
    if (searchResult.total === 0) {
      return '抱歉，没有找到相关命令';
    }
    
    // 2. 获取最相关命令详情
    const topCmd = searchResult.data[0].name;
    const detail = await this.getCommandDetail(topCmd);
    const cmdInfo = detail.data;
    
    // 3. 生成结构化回答
    return {
      command: cmdInfo.name,
      description: cmdInfo.description,
      syntax: cmdInfo.syntax,
      topOptions: cmdInfo.options.slice(0, 5),
      examples: cmdInfo.examples.slice(0, 3),
      relevance: searchResult.data[0].relevance
    };
  }
}

// 使用示例
const agent = new LinuxCommandAgent();

agent.answerQuestion('如何查看进程').then(result => {
  console.log('推荐命令:', result.command);
  console.log('描述:', result.description);
  console.log('语法:', result.syntax);
  console.log('示例:', result.examples);
});
```

---

## 🎯 AI Agent 最佳实践

### 1. 缓存策略
```python
# 缓存命令列表（很少变化）
command_list_cache = None
cache_expiry = 3600  # 1小时

# 缓存常用命令详情
detail_cache = {}
```

### 2. 错误处理
```python
try:
    result = get_command_detail("invalid_cmd")
    if not result['success']:
        # 命令不存在，尝试搜索相似命令
        search_result = search_commands("invalid_cmd")
        if search_result['total'] > 0:
            suggestion = search_result['data'][0]['name']
            return f"命令不存在，您是否要找: {suggestion}?"
except Exception as e:
    return f"查询失败: {str(e)}"
```

### 3. 多命令对比
```python
def compare_commands(cmd1, cmd2):
    detail1 = get_command_detail(cmd1)
    detail2 = get_command_detail(cmd2)
    
    return {
        "comparison": {
            cmd1: detail1['data']['description'],
            cmd2: detail2['data']['description']
        },
        "recommendation": "根据使用场景选择..."
    }
```

---

## 📊 性能优化

- **命令列表缓存**：启动时加载到内存
- **Markdown 解析缓存**：首次解析后缓存结果
- **搜索优化**：只返回前 20 个最相关结果
- **响应时间**：< 100ms（本地部署）

---

## 🔧 部署建议

### 开发环境
```bash
node api-server.js
```

### 生产环境（使用 PM2）
```bash
npm install -g pm2
pm2 start api-server.js --name "linux-cmd-api"
pm2 save
pm2 startup
```

### Docker 部署
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY . .
EXPOSE 3001
CMD ["node", "api-server.js"]
```

---

## 📝 更新日志

- **v1.0.0** (2026-03-25)
  - 初始版本
  - 支持 cmdlist、search、detailed 三个接口
  - 内置 Markdown 解析器
  - 相关度排序算法
