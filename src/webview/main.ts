import { toPng } from 'html-to-image';

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState<T = unknown>(): T | undefined;
  setState<T>(state: T): void;
};

interface CodeTermSnapConfig {
  fontLigatures?: boolean | string;
  tabSize?: number | string;
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

type WebviewMessage =
  | {
      type: 'update';
    } & CodeTermSnapConfig
  | {
      type: 'flash';
    }
  | {
      type: 'copyReady';
      mode: 'desktop' | 'webview';
    };

const vscode = acquireVsCodeApi();
const saveButton = document.getElementById('save') as HTMLButtonElement;
const navbarNode = document.getElementById('navbar') as HTMLElement;
const windowControlsNode = document.getElementById('window-controls') as HTMLElement;
const windowTitleNode = document.getElementById('window-title') as HTMLElement;
const windowNode = document.getElementById('window') as HTMLDivElement;
const snippetContainerNode = document.getElementById('snippet-container') as HTMLDivElement;
const snippetNode = document.getElementById('snippet') as HTMLDivElement;
const pasteInput = document.getElementById('paste-input') as HTMLTextAreaElement;
const flashFx = document.getElementById('flash-fx') as HTMLDivElement;

const SNAP_SCALE = 2;
const COPY_BUTTON_LABEL = 'Take screenshot';
const COPYING_BUTTON_LABEL = '正在复制';
const COPY_FLASH_OPACITY = 0.14;

let config: CodeTermSnapConfig | undefined;
let copyInProgress = false;
let pendingCopyResolve: ((mode: 'desktop' | 'webview') => void) | undefined;

setCaptureBusy(false);
focusPasteInput();

saveButton.addEventListener('click', () => {
  if (config) {
    void takeSnap(config);
  }
});

document.addEventListener('pointerdown', () => {
  focusPasteInput();
});

document.addEventListener('paste', (event: ClipboardEvent) => {
  event.preventDefault();

  if (config) {
    pasteCode(config, event.clipboardData);
  }

  focusPasteInput();
});

document.addEventListener('keydown', (event) => {
  if (document.hasFocus() && isPasteShortcut(event)) {
    event.preventDefault();
    requestPasteFromClipboard();
  }
});

window.addEventListener('message', ({ data }: MessageEvent<WebviewMessage>) => {
  if (data.type === 'update') {
    config = data;

    const {
      fontLigatures,
      tabSize,
      fontSize,
      backgroundColor,
      boxShadow,
      containerPadding,
      roundedCorners,
      showWindowControls,
      showWindowTitle,
      windowTitle
    } = config;

    setVar('ligatures', fontLigatures ? 'normal' : 'none');

    if (typeof fontLigatures === 'string') {
      setVar('font-features', fontLigatures);
    }

    setVar('tab-size', tabSize ?? 4);
    setVar('font-size', fontSize);
    setVar('container-background-color', backgroundColor);
    setVar('box-shadow', boxShadow);
    setVar('container-padding', containerPadding);
    setVar('window-border-radius', roundedCorners ? '4px' : 0);

    navbarNode.hidden = !showWindowControls && !showWindowTitle;
    windowControlsNode.hidden = !showWindowControls;
    windowTitleNode.hidden = !showWindowTitle;
    windowTitleNode.textContent = windowTitle;
  } else if (data.type === 'copyReady') {
    pendingCopyResolve?.(data.mode);
    pendingCopyResolve = undefined;
  } else if (data.type === 'flash') {
    void cameraFlashAnimation();
  }
});

function setVar(key: string, value: string | number, node: HTMLElement = document.body): void {
  node.style.setProperty(`--${key}`, String(value));
}

function setCaptureBusy(isBusy: boolean): void {
  copyInProgress = isBusy;
  saveButton.classList.toggle('is-busy', isBusy);
  saveButton.setAttribute('aria-busy', String(isBusy));
  saveButton.setAttribute('aria-label', isBusy ? COPYING_BUTTON_LABEL : COPY_BUTTON_LABEL);
  saveButton.title = isBusy ? COPYING_BUTTON_LABEL : COPY_BUTTON_LABEL;
}

function focusPasteInput(): void {
  if (document.activeElement !== pasteInput) {
    pasteInput.focus({ preventScroll: true });
  }
}

function requestPasteFromClipboard(): void {
  focusPasteInput();
  pasteInput.value = '';
  document.execCommand('paste');
}

function isPasteShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'v';
}

function requestClipboardCopy(data: string): Promise<'desktop' | 'webview'> {
  return new Promise((resolve) => {
    pendingCopyResolve = resolve;
    vscode.postMessage({ type: 'copy', data });
  });
}

function yieldToBrowserPaint(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function redraw(node: HTMLElement): void {
  void node.clientHeight;
}

function once(element: HTMLElement, eventName: string): Promise<Event> {
  return new Promise((resolve) => element.addEventListener(eventName, resolve, { once: true }));
}

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n/gu, '\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

function calcTextWidth(text: string): string {
  const testNode = document.body.appendChild(document.createElement('div'));
  testNode.classList.add('size-test');
  testNode.textContent = text;
  const width = testNode.clientWidth;
  testNode.remove();
  return `${width + 1}px`;
}

function $<T extends Element>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector(selector) as T | null;
}

function $$<T extends Element>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll(selector)) as T[];
}

async function cameraFlashAnimation(): Promise<void> {
  flashFx.style.display = 'block';
  flashFx.style.opacity = String(COPY_FLASH_OPACITY);
  redraw(flashFx);
  flashFx.style.opacity = '0';
  await once(flashFx, 'transitionend');
  flashFx.style.display = 'none';
  flashFx.style.opacity = String(COPY_FLASH_OPACITY);
}

async function takeSnap(currentConfig: CodeTermSnapConfig): Promise<void> {
  if (copyInProgress) {
    return;
  }

  const originalBackground = currentConfig.backgroundColor;
  const shouldClearBackground = currentConfig.transparentBackground || currentConfig.target === 'window';
  const isCopyAction = currentConfig.shutterAction === 'copy';

  if (shouldClearBackground) {
    setVar('container-background-color', 'transparent');
  }

  if (isCopyAction) {
    setCaptureBusy(true);
    await yieldToBrowserPaint();
  }

  const target = currentConfig.target === 'container' ? snippetContainerNode : windowNode;

  try {
    const url = await toPng(target, {
      backgroundColor: 'transparent',
      pixelRatio: SNAP_SCALE,
      cacheBust: false
    });

    const data = url.slice(url.indexOf(',') + 1);

    if (currentConfig.shutterAction === 'copy') {
      const copyMode = await requestClipboardCopy(data);

      if (copyMode === 'webview') {
        try {
          await copyImageToClipboard(data);
        } catch (error) {
          console.error('CodeTermSnap: failed to write image to clipboard.', error);
          return;
        }
      }

      await cameraFlashAnimation();
      return;
    }

    vscode.postMessage({ type: currentConfig.shutterAction, data });
  } finally {
    if (isCopyAction) {
      setCaptureBusy(false);
    }

    setVar('container-background-color', originalBackground);
    focusPasteInput();
  }
}

async function copyImageToClipboard(data: string): Promise<void> {
  const binary = atob(data);
  const array = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    array[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([array], { type: 'image/png' });
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

function pasteCode(currentConfig: CodeTermSnapConfig, clipboard: DataTransfer | null): void {
  if (!clipboard) {
    return;
  }

  snippetNode.innerHTML = getClipboardHtml(clipboard);

  const code = $('div', snippetNode) as HTMLDivElement | null;
  if (!code) {
    return;
  }

  snippetNode.style.fontSize = code.style.fontSize;
  snippetNode.style.lineHeight = code.style.lineHeight;
  snippetNode.innerHTML = code.innerHTML;
  stripInitialIndent(snippetNode);
  setupLines(snippetNode, currentConfig);
  focusPasteInput();
}

function setupLines(node: HTMLElement, currentConfig: CodeTermSnapConfig): void {
  $$<HTMLBRElement>(':scope > br', node).forEach((row) => {
    row.outerHTML = '<div>&nbsp;</div>';
  });

  const rows = $$<HTMLDivElement>(':scope > div', node);
  setVar('line-number-width', calcTextWidth(String(rows.length + currentConfig.startLine)));

  rows.forEach((row, index) => {
    const newRow = document.createElement('div');
    newRow.classList.add('line');
    row.replaceWith(newRow);

    if (currentConfig.showLineNumbers) {
      const lineNumber = document.createElement('div');
      lineNumber.classList.add('line-number');
      lineNumber.textContent = String(index + 1 + currentConfig.startLine);
      newRow.appendChild(lineNumber);
    }

    const spacer = document.createElement('span');
    spacer.textContent = ' ';
    row.appendChild(spacer);

    const lineCodeWrapper = document.createElement('div');
    lineCodeWrapper.classList.add('line-code');

    const lineCode = document.createElement('span');
    lineCode.innerHTML = row.innerHTML;
    lineCodeWrapper.appendChild(lineCode);

    newRow.appendChild(lineCodeWrapper);
  });
}

function stripInitialIndent(node: HTMLElement): void {
  const regIndent = /^\s+/u;
  const initialSpans = $$<HTMLSpanElement>(':scope > div > span:first-child', node);

  const minIndent = Math.min(
    ...initialSpans.map((span) => (span.textContent ?? '').match(regIndent)?.[0].length ?? 0)
  );

  if (minIndent > 0) {
    initialSpans.forEach((span) => {
      span.textContent = (span.textContent ?? '').slice(minIndent);
    });
  }
}

function getClipboardHtml(clipboard: DataTransfer): string {
  const html = clipboard.getData('text/html');
  if (html) {
    return html;
  }

  const text = clipboard.getData('text/plain');
  return `<div>${normalizeLineBreaks(text)
    .split('\n')
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join('')}</div>`;
}