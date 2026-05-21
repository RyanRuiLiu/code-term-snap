# CodeTermSnap

> 在 VS Code 中将代码和终端文字截图为精美的语法高亮图片。纯手动粘贴，不干扰编辑器。

## 快速开始

1. **复制** — 在编辑器中 `Ctrl+C` 复制一段代码，或在终端中复制一段文字
2. **打开** — 右键菜单选择 `CodeTermSnap`，或通过命令面板 (`Ctrl+Shift+P`) 运行
3. **粘贴** — 在预览面板中 `Ctrl+V` 粘贴内容
4. **导出** — 点击快门按钮，保存为 PNG 或复制到剪贴板

---

## 安装

### 从 VS Code 扩展市场

在扩展面板 (`Ctrl+Shift+X`) 中搜索 **CodeTermSnap**。

### 从 VSIX 文件

```bash
vsce package
code --install-extension code-term-snap-0.1.0.vsix
```

---

## 配置

所有设置均以 `codetermsnap.*` 开头，可通过 **文件 > 首选项 > 设置** 进行配置。

| 设置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `codetermsnap.shutterAction` | `"save"` \| `"copy"` | `"save"` | 导出方式：保存为文件或复制到剪贴板 |
| `codetermsnap.target` | `"container"` \| `"window"` | `"container"` | 截图范围：完整容器（含内边距）或仅代码窗口 |
| `codetermsnap.backgroundColor` | `string` | `"transparent"` | 代码窗口外的背景色 |
| `codetermsnap.boxShadow` | `string` | `"rgba(0, 0, 0, 0.12) 0px 0px 12px"` | 代码窗口的 CSS 阴影 |
| `codetermsnap.containerPadding` | `string` | `"16px"` | 截图容器的内边距 |
| `codetermsnap.fontSize` | `number` | `0` | 字号（px）。设为 `0` 时自动回退到编辑器字体、再回退到终端字体 |
| `codetermsnap.roundedCorners` | `boolean` | `true` | 代码窗口是否使用圆角 |
| `codetermsnap.showWindowControls` | `boolean` | `false` | 是否显示 macOS 风格的红黄绿窗口控制点 |
| `codetermsnap.showWindowTitle` | `boolean` | `true` | 是否显示窗口标题栏 |
| `codetermsnap.showLineNumbers` | `boolean` | `true` | 是否在截图中显示行号 |
| `codetermsnap.realLineNumbers` | `boolean` | `false` | 行号是否从文件的实际行号开始 |
| `codetermsnap.transparentBackground` | `boolean` | `false` | 导出时是否使用透明背景 |

---

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm compile

# 监听模式（文件变更自动重新构建）
pnpm watch

# 类型检查
pnpm typecheck
```

调试时在 VS Code 中打开本项目，按 `F5` 启动**扩展开发宿主**。

---

## 打包发布

扩展已通过 esbuild 将依赖全部打包，打包时使用 `--no-dependencies` 跳过依赖校验。

```bash
# 安装 VS Code 打包工具
npm install -g @vscode/vsce

# 一键打包
pnpm package

# 或手动分步执行
pnpm compile
vsce package --no-dependencies --allow-missing-repository
```

---

## 许可

MIT © Ryan Liu