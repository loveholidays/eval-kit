export class TemplateRenderer {
	render(template: string, variables: Record<string, unknown>): string {
		let result = template;
		result = this.processConditionals(result, variables);
		result = this.processVariables(result, variables);
		return result.trim();
	}

	private processConditionals(
		template: string,
		variables: Record<string, unknown>,
	): string {
		const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

		return template.replace(conditionalRegex, (_, varName, content) => {
			const value = variables[varName];

			const isTruthy =
				value !== undefined &&
				value !== null &&
				value !== "" &&
				value !== false &&
				(typeof value !== "object" || Object.keys(value as object).length > 0);

			return isTruthy ? content : "";
		});
	}

	private processVariables(
		template: string,
		variables: Record<string, unknown>,
	): string {
		const variableRegex = /\{\{(\w+)\}\}/g;

		return template.replace(variableRegex, (_, varName) => {
			const value = variables[varName];

			if (value === undefined || value === null) {
				return "";
			}

			return this.stringify(value);
		});
	}

	private stringify(value: unknown): string {
		if (typeof value === "string") {
			return value;
		}

		if (typeof value === "number" || typeof value === "boolean") {
			return String(value);
		}

		if (typeof value === "object" && value !== null) {
			return JSON.stringify(value);
		}

		return String(value);
	}

	validate(template: string): string[] {
		const errors: string[] = [];

		const openIfs = (template.match(/\{\{#if\s+\w+\}\}/g) || []).length;
		const closeIfs = (template.match(/\{\{\/if\}\}/g) || []).length;

		if (openIfs !== closeIfs) {
			errors.push(
				`Mismatched conditional blocks: ${openIfs} opening {{#if}} but ${closeIfs} closing {{/if}}`,
			);
		}

		const conditionalRegex = /\{\{#if\s+\w+\}\}([\s\S]*?)\{\{\/if\}\}/g;
		const matches = template.matchAll(conditionalRegex);
		for (const match of matches) {
			const content = match[1];
			if (content && /\{\{#if\s+\w+\}\}/.test(content)) {
				errors.push("Nested conditionals are not supported");
				break;
			}
		}

		const unknownTags = template.match(/\{\{[#/](?!if|\/if)[^}]*\}\}/g);
		if (unknownTags) {
			errors.push(`Unknown template tags: ${unknownTags.join(", ")}`);
		}

		return errors;
	}

	extractVariables(template: string): string[] {
		const variables = new Set<string>();

		const conditionals = template.matchAll(/\{\{#if\s+(\w+)\}\}/g);
		for (const match of conditionals) {
			variables.add(match[1]!);
		}

		const substitutions = template.matchAll(/\{\{(\w+)\}\}/g);
		for (const match of substitutions) {
			variables.add(match[1]!);
		}

		return Array.from(variables);
	}

	extractRequiredVariables(template: string): string[] {
		const required = new Set<string>();
		const optional = new Set<string>();

		const conditionals = template.matchAll(
			/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
		);
		for (const match of conditionals) {
			optional.add(match[1]!);

			const innerVars = match[2]!.matchAll(/\{\{(\w+)\}\}/g);
			for (const innerMatch of innerVars) {
				optional.add(innerMatch[1]!);
			}
		}

		const parts = template.split(/\{\{#if[\s\S]*?\{\{\/if\}\}/g);
		for (const part of parts) {
			const substitutions = part.matchAll(/\{\{(\w+)\}\}/g);
			for (const match of substitutions) {
				const varName = match[1]!;
				if (!optional.has(varName)) {
					required.add(varName);
				}
			}
		}

		return Array.from(required);
	}
}
