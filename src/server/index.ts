/**
 * great thanks to https://github.com/vunguyentuan/vscode-css-variables and repo owner Vu Nguyen
 */
import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
	ClientCapabilities,
    TextDocumentSyncKind,
    InitializeResult,
	DocumentDiagnosticRequest,
	DidOpenTextDocumentNotification
} from 'vscode-languageserver/node';
import CSSVariableManager, { CSSVariablesSettings, defaultSettings } from './managers/CssVariableManager';
import {
    TextDocument
} from 'vscode-languageserver-textdocument';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
let hasPullDiagnostics = false;

const cssVariableManager = new CSSVariableManager();

// ------------------------ Language server lifesycle ------------------------ 
connection.onInitialize(async (params: InitializeParams) => {
	// capaticites client supports, sends through "initialize" request
	const capabilities = params.capabilities;
  
	// if client supports workspace/configuration request
	// https://microsoft.github.io/language-server-protocol/specifications/specification-3-15/#workspace_configuration
	hasConfigurationCapability = !!(
	  capabilities.workspace && !!capabilities.workspace.configuration
	);
	// if clients support for workspace folders
	hasWorkspaceFolderCapability = !!(
	  capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	// if clients support publish diagnostics notifications
	// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#publishDiagnosticsClientCapabilities
	hasDiagnosticRelatedInformationCapability = !!(
	  capabilities.textDocument &&
	  capabilities.textDocument.publishDiagnostics &&
	  capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	hasPullDiagnostics = !!(
		capabilities.textDocument &&
		capabilities.textDocument.diagnostic &&
		capabilities.textDocument.diagnostic.relatedDocumentSupport

	)
  
	// construct server capacities
	// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#serverCapabilities
	const result: InitializeResult = {
	  capabilities: {
		textDocumentSync: TextDocumentSyncKind.Incremental,
		diagnosticProvider: {
			identifier: 'CssVariableCheck',
			interFileDependencies: false,
			workspaceDiagnostics: false
		},
		definitionProvider: true,
		hoverProvider: true,
		colorProvider: true,
	  },
	};
  
	if (hasWorkspaceFolderCapability) {
	  result.capabilities.workspace = {
		workspaceFolders: {
		  supported: true,
		},
	  };
	}
	return result;
  });

  connection.onInitialized(async () => {
	if (hasConfigurationCapability) {
	  // Register for all configuration changes.
	  connection.client.register(
		DidChangeConfigurationNotification.type,
		undefined
	  );
	}
	if (hasWorkspaceFolderCapability) {
	  connection.workspace.onDidChangeWorkspaceFolders((_event) => {
		connection.console.log('Workspace folder change event received.');
	  });
	}
	if (hasPullDiagnostics) {
		connection.client.register(
			DidOpenTextDocumentNotification.type
		)
	}
  
	const workspaceFolders = await connection.workspace.getWorkspaceFolders();
	const validFolders = workspaceFolders
	  ?.map((folder) => uriToPath(folder.uri) || '')
	  .filter((path) => !!path);
  
	const settings = await getDocumentSettings();
  
	// parse and sync variables
	cssVariableManager.parseAndSyncVariables(validFolders || [], settings);
  });

