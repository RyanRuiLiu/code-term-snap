import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { getWebviewContent } from './webview/getWebviewContent';

interface CodeTermSnapConfig {
  fontLigatures: boolean | string | undefined;
  tabSize: number | string | undefined;
  fontSize: number;
  backgroundColor: string;
  boxShadow: string;
  containerPadding: string;
  roundedCorners: boolean;
  showWindowControls: boolean;
  showWindowTitle: boolean;
  showLineNumbers: boolean;
  realLineNumbers: boolean;
  transparentBackground: boolean;
  target: 'container' | 'window';
  shutterAction: 'save' | 'copy';
  startLine: number;
  windowTitle: string;
}

let lastUsedImageDirectory = vscode.Uri.file(path.join(os.homedir(), 'Desktop'));
let activePanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('codetermsnap.capture', () => runCommand(context)),
    vscode.commands.registerCommand('codetermsnap.openSettings', () => openExtensionSettings(context))
  );
}

export function deactivate(): void {}

async function runCommand(context: vscode.ExtensionContext): Promise<void> {
  if (activePanel) {
    activePanel.reveal(activePanel.viewColumn ?? vscode.ViewColumn.Beside, true);
    sendConfig(activePanel);
    return;
  }

  const panel = createPanel(context);
  activePanel = panel;

  panel.onDidDispose(() => {
    if (activePanel === panel) {
      activePanel = undefined;
    }
  });

  panel.webview.onDidReceiveMessage(async (message: { type?: string; data?: string }) => {
    if (message.type === 'save' && typeof message.data === 'string') {
      void panel.webview.postMessage({ type: 'flash' });
      await saveImage(message.data);
      return;
    }

    if (message.type === 'copy' && typeof message.data === 'string') {
      await copyImageToClipboard(panel, message.data);
      return;
    }

    vscode.window.showErrorMessage(`CodeTermSnap: Unknown shutterAction "${String(message.type)}"`);
  });

  sendConfig(panel);
}

async function openExtensionSettings(context: vscode.ExtensionContext): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${context.extension.id}`);
}

function createPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'codetermsnap',
    'CodeTermSnap',
    {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true
    },
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
    }
  );

  panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
  return panel;
}

function sendConfig(panel: vscode.WebviewPanel): void {
  void panel.webview.postMessage({ type: 'update', ...getConfig() });
}

async function copyImageToClipboard(panel: vscode.WebviewPanel, data: string): Promise<void> {
  if (process.platform !== 'win32') {
    await panel.webview.postMessage({ type: 'copyReady', mode: 'webview' });
    return;
  }

  try {
    const clipboardImagePath = getWindowsClipboardImagePath();
    await fs.writeFile(clipboardImagePath, Buffer.from(data, 'base64'));
    await setWindowsFileClipboard(clipboardImagePath);
    await panel.webview.postMessage({ type: 'copyReady', mode: 'desktop' });
  } catch {
    await panel.webview.postMessage({ type: 'copyReady', mode: 'webview' });
  }
}

function getWindowsClipboardImagePath(): string {
  return path.join(os.tmpdir(), `CodeTermSnap-${formatClockTime(new Date())}.png`);
}

function setWindowsFileClipboard(filePath: string): Promise<void> {
  const escapedPath = escapePowerShellSingleQuotedString(filePath);
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$files = New-Object System.Collections.Specialized.StringCollection',
    `$null = $files.Add('${escapedPath}')`,
    '[System.Windows.Forms.Clipboard]::SetFileDropList($files)'
  ].join('; ');

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-STA', '-Command', script],
      { windowsHide: true },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      }
    );
  });
}

function escapePowerShellSingleQuotedString(value: string): string {
  return value.replace(/'/gu, "''");
}

function getConfig(): CodeTermSnapConfig {
  const editor = vscode.window.activeTextEditor;
  const editorSettings = readEditorSettings();
  const extensionSettings = readExtensionSettings();

  const startLine = extensionSettings.realLineNumbers && editor?.selection ? editor.selection.start.line : 0;
  let windowTitle = '';

  if (editor && extensionSettings.showWindowTitle) {
    const activeFileName = getFileName(editor.document.uri, editor.document.fileName);
    windowTitle = vscode.workspace.name ? `${vscode.workspace.name} - ${activeFileName}` : activeFileName;
  }

  return {
    ...editorSettings,
    ...extensionSettings,
    fontSize: getFontSize(),
    startLine,
    windowTitle
  };
}

function readEditorSettings(): Pick<CodeTermSnapConfig, 'fontLigatures' | 'tabSize'> {
  return {
    fontLigatures: readSetting('editor', 'fontLigatures') as boolean | string | undefined,
    tabSize: getActiveEditorTabSize()
  };
}

function getActiveEditorTabSize(): number | string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    return editor.options.tabSize;
  }

  return readSetting('editor', 'tabSize') as number | string | undefined;
}

function getFontSize(): number {
  const configuredFontSize = readSetting('codetermsnap', 'fontSize');
  const explicitFontSize = toPositiveNumber(configuredFontSize);
  if (explicitFontSize !== undefined) {
    return explicitFontSize;
  }

  const editorFontSize = toPositiveNumber(readSetting('editor', 'fontSize'));
  if (editorFontSize !== undefined) {
    return editorFontSize;
  }

  const terminalFontSize = toPositiveNumber(
    vscode.workspace.getConfiguration('terminal.integrated').get('fontSize')
  );
  if (terminalFontSize !== undefined) {
    return terminalFontSize;
  }

  return 14;
}

function readExtensionSettings(): Omit<
  CodeTermSnapConfig,
  'fontLigatures' | 'tabSize' | 'fontSize' | 'startLine' | 'windowTitle'
> {
  return {
    backgroundColor: String(readSetting('codetermsnap', 'backgroundColor') ?? 'transparent'),
    boxShadow: String(readSetting('codetermsnap', 'boxShadow') ?? 'rgba(0, 0, 0, 0.12) 0px 0px 12px'),
    containerPadding: String(readSetting('codetermsnap', 'containerPadding') ?? '16px'),
    roundedCorners: Boolean(readSetting('codetermsnap', 'roundedCorners')),
    showWindowControls: Boolean(readSetting('codetermsnap', 'showWindowControls')),
    showWindowTitle: Boolean(readSetting('codetermsnap', 'showWindowTitle')),
    showLineNumbers: Boolean(readSetting('codetermsnap', 'showLineNumbers')),
    realLineNumbers: Boolean(readSetting('codetermsnap', 'realLineNumbers')),
    transparentBackground: Boolean(readSetting('codetermsnap', 'transparentBackground')),
    target: (readSetting('codetermsnap', 'target') as 'container' | 'window') ?? 'container',
    shutterAction: (readSetting('codetermsnap', 'shutterAction') as 'save' | 'copy') ?? 'save'
  };
}

function readSetting(group: string, key: string): unknown {
  const editor = vscode.window.activeTextEditor;
  const languageId = editor?.document.languageId;
  const languageSettings = languageId
    ? (vscode.workspace.getConfiguration(undefined).get(`[${languageId}]`) as Record<string, unknown> | undefined)
    : undefined;

  const namespacedKey = `${group}.${key}`;
  if (languageSettings && Object.prototype.hasOwnProperty.call(languageSettings, namespacedKey)) {
    return languageSettings[namespacedKey];
  }

  const value = vscode.workspace.getConfiguration(group).get(key);
  return value;
}

async function saveImage(data: string): Promise<void> {
  const uri = await vscode.window.showSaveDialog({
    filters: { Images: ['png'] },
    defaultUri: getDefaultImageUri()
  });

  if (!uri) {
    return;
  }

  lastUsedImageDirectory = vscode.Uri.file(path.dirname(uri.fsPath));
  await fs.writeFile(uri.fsPath, Buffer.from(data, 'base64'));
}

function getDefaultImageUri(): vscode.Uri {
  const fileName = `CodeTermSnap-${formatTimestamp(new Date())}.png`;
  return vscode.Uri.file(path.join(lastUsedImageDirectory.fsPath, fileName));
}

function formatTimestamp(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}-${milliseconds}`;
}

function formatClockTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  return `${hours}-${minutes}-${seconds}-${milliseconds}`;
}

function toPositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  return undefined;
}

function getFileName(uri: vscode.Uri, fileName: string): string {
  const source = fileName || uri.fsPath || uri.path || 'untitled';
  return path.basename(source);
}