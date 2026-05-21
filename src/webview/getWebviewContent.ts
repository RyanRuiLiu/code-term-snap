import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const stylesUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'webview', 'styles.css')
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'webview', 'main.js')
  );
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} data: https:; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}';"
    />
    <title>CodeTermSnap</title>
    <link rel="stylesheet" href="${stylesUri}" />
  </head>

  <body data-vscode-context='{"webviewSection":"preview"}'>
    <textarea id="paste-input" aria-hidden="true" tabindex="0"></textarea>

    <div id="save-container">
      <button id="save" class="shutter" type="button" aria-label="Take screenshot"></button>
    </div>

    <div id="snippet-scroll">
      <div id="snippet-container">
        <div id="window">
          <div id="navbar">
            <div id="window-controls">
              <div class="red dot"></div>
              <div class="yellow dot"></div>
              <div class="green dot"></div>
            </div>
            <div id="window-title"></div>
          </div>
          <div id="snippet"></div>
        </div>
      </div>
    </div>

    <div id="flash-fx"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

function getNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let index = 0; index < 32; index += 1) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  return result;
}
