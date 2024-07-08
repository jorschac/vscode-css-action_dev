import {Diagnostic, DiagnosticSeverity, Range} from 'vscode'

/**
 * return a new Diagnostic Instance
 * @param range - where diagnostic should be given
 */
export default function getDiagnostic(range: Range): Diagnostic {
	const diag = new Diagnostic(
		range,
		'The value of style property does not meet standards',
		DiagnosticSeverity.Hint
	)
	diag.source = 'vscode css action'
	diag.code = 1
	return diag
}

