import * as vscode from "vscode";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { render } from "ejs";
import tinycolor from "tinycolor2";
import CssVariableManager from './managers/CssVariableManager'
import pathUtils from 'path'

enum BultinTemplateVar {
  remResult = "_REM_RESULT_",
  varName = "_VAR_NAME_",
  matchedText = "_MATCHED_TEXT_",
}
let variablesFilePath: string | undefined;
let baseDir: string
let variableMapper = new Map<string, Set<string>>();
let rootFontSize: number;
let pxReplaceOptions: string[];
let colorReplaceOptions: string[];
const manager = new CssVariableManager()

function normalizeSizeValue(str: string) {
  const sizeReg = /\b\d+(px|rem|em)\b/g;
  const result = str.toLowerCase().match(sizeReg);
  if (result) {
    return result.join(" ");
  } else {
    return null;
  }
}

function normalizeColorValue(str: string) {
  if (str) {
    const color = tinycolor(str);
    return color.isValid() ? tinycolor(str).toHex8String() : null;
  } else {
    return null;
  }
}

function getVariablesMapper(path: string) {
  const directory = pathUtils.dirname(path)
  console.log('展示一下var文件的DIRECTORY', directory)
  manager.parseAndSyncVariables([directory])
  const varMapper = new Map<string, Set<string>>();
  const cached = manager.getAll()
  console.log('展示所有cached数据？', cached)


  // if (matches) {
  //   for (const match of matches) {
  //     let [varName, varValue] = [match[1], match[2]];
  //     varValue =
  //       normalizeSizeValue(varValue) ||
  //       normalizeColorValue(varValue) ||
  //       varValue ||
  //       "";

  //     if (varName.startsWith("--")) {
  //       varName = `var(${varName})`;
  //     }
  //     if (!varMapper.get(varValue)) {
  //       varMapper.set(varValue, new Set());
  //     }
  //     varMapper.get(varValue)!.add(varName);
  //   }
  // }
  return varMapper;
}

const renderVarNamesTpl = (
  tplString: string,
  varNames: Array<string>,
  context: any
) => {
  return varNames.map((varName) => {
    return render(tplString, {
      [BultinTemplateVar.varName]: varName,
      ...context,
    });
  });
};

const renderOptions = (
  optionTpls: string[],
  varNames: Set<string>,
  context: any
) => {
  let result: string[] = [];
  for (const option of optionTpls) {
    if (option.includes(BultinTemplateVar.varName)) {
      result = result.concat(
        renderVarNamesTpl(option, Array.from(varNames), context)
      );
    } else {
      result.push(render(option, context));
    }
  }
  return result;
};

export async function showQuickPick() {
  const quickPick = vscode.window.createQuickPick();
  quickPick.matchOnDescription = true;
  quickPick.ignoreFocusOut = true;
  quickPick.placeholder = "Search var name and value";
  const options: vscode.QuickPickItem[] = [];
  variableMapper.forEach((values, key) => {
    options.push(
      ...Array.from(values).map((i) => ({ label: i, description: key }))
    );
  });

  quickPick.items = options;
  quickPick.onDidHide(() => quickPick.dispose());
  quickPick.show();

  quickPick.onDidChangeSelection((i) => {
    quickPick.hide();
    const selected = i[0];
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const text = selected.label;
    editor.edit((textEditorEdit) =>
      editor.selections.forEach((selection) =>
        textEditorEdit.replace(selection, text)
      )
    );
  });
}

function init(context: vscode.ExtensionContext) {
  console.log('拓展开始载入了。。。')
  const workbenchConfig = vscode.workspace.getConfiguration("cssAction");
  variablesFilePath = workbenchConfig.get<string>("variablesFile");
  baseDir = workbenchConfig.get<string>("baseDir") || '';
  rootFontSize = workbenchConfig.get<number>("rootFontSize")!;
  pxReplaceOptions = workbenchConfig.get<string[]>("pxReplaceOptions")!;
  colorReplaceOptions = workbenchConfig.get<string[]>("colorReplaceOptions")!;

  context.subscriptions.forEach((s) => s.dispose());
  console.log('配置信息：', {variablesFilePath, baseDir, rootFontSize, pxReplaceOptions, colorReplaceOptions})
  // local relative path OR public url
  if (variablesFilePath) {
    const fullPath = join(
      baseDir.length? baseDir : vscode.workspace.workspaceFolders![0].uri.fsPath,
      variablesFilePath
    );
    console.log('看一看fullPath是什么', fullPath)
    if(!existsSync(fullPath)) {
      vscode.window.showWarningMessage('The path to your variables file doesn\'t seem to exist, check path in your extension settings and restart VSCode', 'yes')
      .then(input => {
        console.log('检查弹窗的用户输入', input)
        if(typeof input === 'string' && input === 'yes') {
          vscode.commands.executeCommand('workbench.action.openSettings')
        }
      })
    }
    manager.clearAllCache()
    variableMapper = getVariablesMapper(fullPath);

    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        ColorVarReplacer.documentSelectors,
        new ColorVarReplacer(),
        {
          providedCodeActionKinds: ColorVarReplacer.providedCodeActionKinds,
        }
      )
    );
  }

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      PxReplacer.documentSelectors,
      new PxReplacer(),
      {
        providedCodeActionKinds: PxReplacer.providedCodeActionKinds,
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cssAction.pickVariable", showQuickPick)
  );
}

export function activate(context: vscode.ExtensionContext) {
  console.log('哥们儿不会连这儿都没执行到吧？')
  init(context);
  vscode.workspace.onDidChangeConfiguration(() => init(context));
}

abstract class RegexReplacer implements vscode.CodeActionProvider {
  public abstract regex: RegExp;

  public static documentSelectors = [
    { language: "css" },
    { language: "scss" },
    { language: "less" },
    { language: "vue" },
    { language: "jsx" },
    { language: "tsx" },
  ];

  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] | undefined {
    const [matchResult, line] = this.isMatchRegex(document, range);
    if (!matchResult) {
      return;
    }
    const lineRange = line.range;
    const originText = matchResult[0].trim();

    const originRange = new vscode.Range(
      lineRange.start.translate(0, matchResult.index),
      lineRange.start.translate(0, matchResult.index + originText.length)
    );

    const targetTexts = this.getReplaceTargets(originText);

    const fixes = targetTexts.map((targetText) =>
      this.createFix(document, originRange, targetText, originText)
    );

    if (fixes.length) {
      fixes[0].isPreferred = true;
    }

    return fixes;
  }

  public abstract getReplaceTargets(originText: string): string[];

  private isMatchRegex(
    document: vscode.TextDocument,
    range: vscode.Range
  ): [RegExpExecArray | null, vscode.TextLine] {
    const line = document.lineAt(range.start);
    const matchResult = this.regex.exec(line.text);
    return [matchResult, line];
  }

  private createFix(
    document: vscode.TextDocument,
    range: vscode.Range,
    targetText: string,
    originText: string
  ): vscode.CodeAction {
    const fix = new vscode.CodeAction(
      `Replace [ ${originText} ] with ${targetText}`,
      vscode.CodeActionKind.QuickFix
    );
    fix.edit = new vscode.WorkspaceEdit();
    fix.edit.replace(document.uri, range, targetText);
    return fix;
  }
}

/**
 * Provides code actions for converting px.
 */
class PxReplacer extends RegexReplacer {
  public regex = new RegExp("(-?\\d+(px|rem|em)\\s*)+(?![^(]*\\))", "i");

  private calcRem(originText: string): string {
    return originText
      .split(/\s+/)
      .map((item) => {
        const unit = item.replace(/\d+/, "");
        if (unit === "px") {
          const result = parseInt(item) / rootFontSize;
          const resultStr = result.toFixed(4).replace(/\.?0+$/, "");
          return `${resultStr}rem`;
        } else {
          return item;
        }
      })
      .join(" ");
  }

  public getReplaceTargets(originText: string): string[] {
    const normalizedOrigin = normalizeSizeValue(originText) || "";

    const varNames = variableMapper.get(normalizedOrigin) || new Set();
    const context = {
      [BultinTemplateVar.matchedText]: originText,
      [BultinTemplateVar.remResult]: this.calcRem(normalizedOrigin),
    };
    return renderOptions(pxReplaceOptions, varNames, context);
  }
}

/**
 * Provides code actions for converting hex color string to a color var.
 */

const colorRegexParts = [
  "(#[0-9a-f]{3,8}\\b)",
  "(rgb|hsl)a?[^)]*\\)",
  `(\\b(${Object.keys(tinycolor.names).join("|")})\\b)`,
];

const colorRegex = new RegExp(colorRegexParts.join("|"), "i");

class ColorVarReplacer extends RegexReplacer {
  public regex = colorRegex;

  public getReplaceTargets(originText: string): string[] {
    const colorStr = tinycolor(originText).toHex8String();
    const varNames = variableMapper.get(colorStr) || new Set();
    const context = {
      [BultinTemplateVar.matchedText]: originText,
    };

    return renderOptions(colorReplaceOptions, varNames, context);
  }
}
