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
    TextDocumentSyncKind,
    InitializeResult
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

const cssVariableManager = new CSSVariableManager();

// ------------------------ Language server lifesycle ------------------------ 
connection.onInitialize(async (params: InitializeParams) => {
	const capabilities = params.capabilities;
  
	// check editor capacities
	hasConfigurationCapability = !!(
	  capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
	  capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
	  capabilities.textDocument &&
	  capabilities.textDocument.publishDiagnostics &&
	  capabilities.textDocument.publishDiagnostics.relatedInformation
	);
  
	// construct server capacities
	const result: InitializeResult = {
	  capabilities: {
		textDocumentSync: TextDocumentSyncKind.Incremental,
		completionProvider: {
		  resolveProvider: true,
		},
		diagnosticProvider: {
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

