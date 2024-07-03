/**
 * great thanks to https://github.com/vunguyentuan/vscode-css-variables and repo owner Vu Nguyen
 */
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import * as vscode from "vscode";
import path from "path";

const LANGUAGES = [
  "astro",
  "svelte",
  "vue",
  "vue-html",
  "vue-postcss",
  "scss",
  "postcss",
  "less",
  "css",
  "html",
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
  "source.css.styled",
];

let clientInstance: LanguageClient;
/**
 * 启动lsp
 * @param context
 */
function startServer(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // 构建服务配置，区别运行环境
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // 构建客户端配置
  const clientOptions: LanguageClientOptions = {
    documentSelector: LANGUAGES.map((language) => ({
      scheme: "file",
      language,
    })),
    synchronize: {
      fileEvents: [
        vscode.workspace.createFileSystemWatcher("**/*.css"),
        vscode.workspace.createFileSystemWatcher("**/*.scss"),
        vscode.workspace.createFileSystemWatcher("**/*.sass"),
        vscode.workspace.createFileSystemWatcher("**/*.less"),
      ],
    },
  };
  clientInstance = new LanguageClient(
    "cssVariables",
    "CSS Variables Language Server",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  clientInstance.start();
}

export default startServer
