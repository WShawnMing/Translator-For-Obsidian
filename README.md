# Translator For Obsidian

为 Obsidian 桌面端设计的划词翻译插件，支持 Markdown 与 PDF 视图，交互参考沉浸式翻译的轻量触发方式：

- 选中文本后，延迟出现蓝色小圆点
- 鼠标悬停小圆点开始翻译，也支持点击触发
- 使用可拖拽的悬浮翻译面板展示结果
- 支持 OpenAI 风格的 `/chat/completions` 接口
- 支持上下文增强、调试模式、翻译模式切换与自定义

## 功能特性

- Markdown 编辑模式支持划词翻译
- Markdown 阅读模式支持划词翻译
- PDF 页面支持划词翻译
- 小圆点延迟出现，减少选区过程中的干扰
- 翻译面板支持拖拽、固定、复制、关闭
- 支持多种翻译模式
- 支持编辑内置 mode 提示词
- 支持新增自定义翻译 mode
- 支持上下文开关
- 支持结构化 Debug 模式
- 支持自定义小圆点和控制按钮颜色

## 适用范围

- 仅支持桌面版 Obsidian
- 当前插件使用 OpenAI-compatible `chat/completions` 协议
- 不支持移动端

## 安装

### 方式一：手动安装到本地 Vault

1. 打开你的 vault 目录。
2. 进入 `.obsidian/plugins/translator-for-obsidian/`。
3. 将以下文件放入该目录：
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. 在 Obsidian 中打开：
   - `设置 -> 社区插件`
5. 启用 `Translator For Obsidian`。
6. 执行一次 `Reload app`，确保最新资源被加载。

### 方式二：从源码本地开发安装

```bash
git clone https://github.com/WShawnMing/Translator-For-Obsidian.git
cd Translator-For-Obsidian
npm install
npm run build
```

然后将构建产物复制到你的 vault：

```bash
cp manifest.json main.js styles.css /path/to/your/vault/.obsidian/plugins/translator-for-obsidian/
```

## Obsidian 最简配置使用方式

如果你只想尽快用起来，只需要配置下面 3 项：

1. `Base URL`
2. `API key`
3. `Model`

推荐保持其余选项默认。

### 最简配置示例

如果你使用 OpenAI 官方接口：

- `Base URL`: `https://api.openai.com/v1`
- `API key`: 你的 OpenAI API Key
- `Model`: `gpt-4.1-mini`

如果你使用兼容 OpenAI 的第三方服务：

- `Base URL`: 填根地址或兼容接口前缀
- `API key`: 对应服务的 API Key
- `Model`: 对应服务支持的模型名

说明：

- 插件会自动把 `Base URL` 归一化为 `/chat/completions`
- 你可以直接填写：
  - `https://api.openai.com/v1`
  - 或完整地址 `https://api.openai.com/v1/chat/completions`

### 推荐的首次使用步骤

1. 打开 `Settings -> Translator For Obsidian`
2. 填写：
   - `Base URL`
   - `API key`
   - `Model`
3. 保持：
   - `Default translation mode` = `通用`
   - `Target language` = `中文`
4. 点击 `Test API`
5. 打开任意 Markdown 或 PDF 文档
6. 选中文本
7. 等待约 `0.5s`，蓝色小圆点出现
8. 将鼠标移动到小圆点上，等待悬停触发翻译
9. 或者直接点击小圆点立即翻译

## 日常使用

### 划词翻译

1. 在 Markdown 或 PDF 页面中选中文本
2. 等待小圆点出现
3. 悬停或点击小圆点
4. 查看弹出的翻译结果

### 浮动翻译面板

面板支持：

- 拖动位置
- 固定当前面板
- 复制译文
- 关闭面板
- 切换翻译 mode

### 快捷命令

插件提供命令：

- `Translate current selection`

你可以在 Obsidian 的快捷键设置里给它绑定快捷键。

## 配置说明

### Connection

- `Base URL`
  - OpenAI-compatible 根地址或完整 `/chat/completions` 地址
- `API key`
  - 当前 vault 内保存
- `Model`
  - 请求时发送给后端的模型名

### Behavior

- `Default translation mode`
  - 默认翻译风格
- `Target language`
  - 默认目标语言
- `Orb reveal delay (ms)`
  - 选区稳定后多久出现小圆点
- `Hover delay (ms)`
  - 鼠标悬停小圆点多久后自动发起翻译
- `Request timeout (ms)`
  - 请求超时保护

### Translation Modes

该区域用于管理翻译模式。

支持：

- 切换当前编辑中的 mode
- 修改内置 mode 的名称、描述、系统提示词
- 新增自定义 mode
- 删除自定义 mode
- 将内置 mode 恢复为默认提示词

示例模式：

- 通用
- 智能选择
- 科技类翻译大师
- 学术论文翻译师
- 新闻媒体译者
- 金融翻译顾问
- 小说译者
- 医学翻译大师
- 法律行业译者
- GitHub 翻译增强器

### Context

上下文增强用于帮助模型在翻译时做更准确的术语和语义判断。

可选上下文包括：

- Document title
- Nearest heading
- Previous paragraph
- Next paragraph
- File path
- View type
- Source type

这些信息不会单独显示在结果里，而是被拼接到翻译请求的 `user` 消息中作为辅助上下文。

### Appearance

可自定义：

- 小圆点颜色
- 关闭按钮颜色
- 固定按钮颜色
- 复制按钮颜色

### Debug

开启 `Debug mode` 后，翻译面板会展示：

- 当前阶段
- 选区信息
- 实际请求 URL
- 模型名
- 实际发送的上下文
- 请求体
- 响应内容
- 错误信息
- 耗时

如果要排查问题，建议先打开 `Debug mode`。

## 一次完整请求大致是什么样

插件最终会向兼容 OpenAI 的接口发送：

```json
{
  "model": "your-model",
  "stream": false,
  "temperature": 0.2,
  "messages": [
    {
      "role": "system",
      "content": "当前 mode 的系统提示词 + 翻译约束"
    },
    {
      "role": "user",
      "content": "[Selected text]\\n...\\n\\n[Context]\\n..."
    }
  ]
}
```

其中：

- 选中文本一定会进入 `[Selected text]`
- 如果开启了上下文增强，可用上下文会被拼接到 `[Context]`
- 返回结果优先读取 `choices[0].message.content`

## 本地开发

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 目录结构

```text
src/
  main.ts
  selection-controller.ts
  translation-panel.ts
  translation-client.ts
  settings-tab.ts
  context-extractor.ts
  translation-modes.ts
  color-utils.ts
manifest.json
styles.css
main.js
```

### 开发流程建议

1. 修改 `src/` 内代码
2. 执行 `npm run build`
3. 将 `manifest.json`、`main.js`、`styles.css` 同步到 vault 插件目录
4. 在 Obsidian 中执行 `Reload app`

## 故障排查

### 小圆点没有出现

检查：

- 当前是否是桌面版 Obsidian
- 是否真的选中了非空文本
- 是否等待了 `Orb reveal delay`
- 是否在 Markdown 或 PDF 视图中

### 小圆点出现了，但没有翻译

检查：

- `Hover delay (ms)` 是否过大
- 是否已经填写：
  - `Base URL`
  - `API key`
  - `Model`
- 尝试点击小圆点直接触发

### Test API 可以通过，但实际翻译失败

建议：

1. 打开 `Debug mode`
2. 重新翻译一次
3. 检查面板中的：
   - request URL
   - request body
   - response status
   - response preview

### PDF 中无法获取理想上下文

PDF 文本层的结构由 Obsidian 与 PDF text layer 决定，某些 PDF 的上下文提取可能不如 Markdown 稳定。遇到这类情况，可以先关闭部分上下文增强项，只保留核心选区翻译。

## Roadmap

- 导入 / 导出翻译模式
- mode 复制
- 更细粒度的上下文模板
- 更完整的请求预览
- 更强的 PDF 场景适配

## License

MIT
