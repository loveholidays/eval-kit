import { TemplateRenderer } from "./template-engine.js";

describe("Template Engine", () => {
	let renderer: TemplateRenderer;

	beforeEach(() => {
		renderer = new TemplateRenderer();
	});

	describe("render", () => {
		it("should render simple variable substitution", () => {
			const template = "Hello {{name}}!";
			const variables = { name: "World" };
			const result = renderer.render(template, variables);

			expect(result).toBe("Hello World!");
		});

		it("should render multiple variables", () => {
			const template = "{{greeting}} {{name}}! You are {{age}} years old.";
			const variables = { greeting: "Hello", name: "Alice", age: 30 };
			const result = renderer.render(template, variables);

			expect(result).toBe("Hello Alice! You are 30 years old.");
		});

		it("should handle missing variables", () => {
			const template = "Hello {{name}}!";
			const variables = {};
			const result = renderer.render(template, variables);

			expect(result).toBe("Hello !");
		});

		it("should handle conditionals with truthy values", () => {
			const template =
				"Text: {{text}}{{#if reference}}\nReference: {{reference}}{{/if}}";
			const variables = { text: "Hello", reference: "World" };
			const result = renderer.render(template, variables);

			expect(result).toBe("Text: Hello\nReference: World");
		});

		it("should handle conditionals with falsy values", () => {
			const template =
				"Text: {{text}}{{#if reference}}\nReference: {{reference}}{{/if}}";
			const variables = { text: "Hello", reference: "" };
			const result = renderer.render(template, variables);

			expect(result).toBe("Text: Hello");
		});

		it("should handle conditionals with undefined values", () => {
			const template =
				"Text: {{text}}{{#if reference}}\nReference: {{reference}}{{/if}}";
			const variables = { text: "Hello" };
			const result = renderer.render(template, variables);

			expect(result).toBe("Text: Hello");
		});

		it("should handle number variables", () => {
			const template = "Score: {{score}}";
			const variables = { score: 95 };
			const result = renderer.render(template, variables);

			expect(result).toBe("Score: 95");
		});

		it("should handle boolean variables", () => {
			const template = "Passed: {{passed}}";
			const variables = { passed: true };
			const result = renderer.render(template, variables);

			expect(result).toBe("Passed: true");
		});

		it("should handle object variables as JSON", () => {
			const template = "Config: {{config}}";
			const variables = { config: { enabled: true, timeout: 5000 } };
			const result = renderer.render(template, variables);

			expect(result).toBe('Config: {"enabled":true,"timeout":5000}');
		});

		it("should handle array variables as JSON", () => {
			const template = "Items: {{items}}";
			const variables = { items: ["a", "b", "c"] };
			const result = renderer.render(template, variables);

			expect(result).toBe('Items: ["a","b","c"]');
		});

		it("should trim whitespace", () => {
			const template = "  {{text}}  ";
			const variables = { text: "Hello" };
			const result = renderer.render(template, variables);

			expect(result).toBe("Hello");
		});

		it("should handle complex template with multiple conditionals", () => {
			const template = `Evaluate the {{name}}:

Candidate: {{candidateText}}
{{#if sourceText}}Source: {{sourceText}}{{/if}}
{{#if referenceText}}Reference: {{referenceText}}{{/if}}

Provide feedback.`;

			const variables = {
				name: "fluency",
				candidateText: "The quick brown fox",
				sourceText: "Le renard brun rapide",
			};

			const result = renderer.render(template, variables);

			expect(result).toBe(`Evaluate the fluency:

Candidate: The quick brown fox
Source: Le renard brun rapide


Provide feedback.`);
		});

		it("should handle empty object in conditional", () => {
			const template = "{{#if metadata}}Has metadata{{/if}}";
			const variables = { metadata: {} };
			const result = renderer.render(template, variables);

			expect(result).toBe("");
		});

		it("should handle non-empty object in conditional", () => {
			const template = "{{#if metadata}}Has metadata{{/if}}";
			const variables = { metadata: { key: "value" } };
			const result = renderer.render(template, variables);

			expect(result).toBe("Has metadata");
		});

		it("should handle false boolean in conditional", () => {
			const template = "{{#if enabled}}Enabled{{/if}}";
			const variables = { enabled: false };
			const result = renderer.render(template, variables);

			expect(result).toBe("");
		});

		it("should handle null value in conditional", () => {
			const template = "{{#if value}}Has value{{/if}}";
			const variables = { value: null };
			const result = renderer.render(template, variables);

			expect(result).toBe("");
		});

		it("should handle zero value", () => {
			const template = "Score: {{score}}";
			const variables = { score: 0 };
			const result = renderer.render(template, variables);

			expect(result).toBe("Score: 0");
		});
	});

	describe("validate", () => {
		it("should return no errors for valid template", () => {
			const template = "Hello {{name}}!";
			const errors = renderer.validate(template);

			expect(errors).toEqual([]);
		});

		it("should return no errors for template with conditionals", () => {
			const template =
				"{{text}}{{#if reference}}\nReference: {{reference}}{{/if}}";
			const errors = renderer.validate(template);

			expect(errors).toEqual([]);
		});

		it("should detect unclosed conditional", () => {
			const template = "{{text}}{{#if reference}}Reference: {{reference}}";
			const errors = renderer.validate(template);

			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("Mismatched conditional blocks");
		});

		it("should detect unopened conditional", () => {
			const template = "{{text}}{{/if}}";
			const errors = renderer.validate(template);

			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("Mismatched conditional blocks");
		});

		it("should detect nested conditionals", () => {
			const template = "{{#if a}}{{#if b}}Nested{{/if}}{{/if}}";
			const errors = renderer.validate(template);

			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("Nested conditionals are not supported");
		});

		it("should detect unknown template tags", () => {
			const template = "{{#unless condition}}Text{{/unless}}";
			const errors = renderer.validate(template);

			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0]).toContain("Unknown template tags");
		});
	});

	describe("extractVariables", () => {
		it("should extract single variable", () => {
			const template = "Hello {{name}}!";
			const variables = renderer.extractVariables(template);

			expect(variables).toEqual(["name"]);
		});

		it("should extract multiple variables", () => {
			const template = "{{greeting}} {{name}}! Age: {{age}}";
			const variables = renderer.extractVariables(template);

			expect(variables).toEqual(["greeting", "name", "age"]);
		});

		it("should extract variables from conditionals", () => {
			const template = "{{text}}{{#if reference}}{{reference}}{{/if}}";
			const variables = renderer.extractVariables(template);

			// Order may vary due to Set usage
			expect(variables.sort()).toEqual(["reference", "text"]);
		});

		it("should extract unique variables only", () => {
			const template = "{{name}} and {{name}} again";
			const variables = renderer.extractVariables(template);

			expect(variables).toEqual(["name"]);
		});

		it("should return empty array for template with no variables", () => {
			const template = "Hello World!";
			const variables = renderer.extractVariables(template);

			expect(variables).toEqual([]);
		});
	});

	describe("extractRequiredVariables", () => {
		it("should extract required variables", () => {
			const template = "Text: {{text}}";
			const variables = renderer.extractRequiredVariables(template);

			expect(variables).toEqual(["text"]);
		});

		it("should not include variables inside conditionals", () => {
			const template =
				"Text: {{text}}{{#if reference}}\nReference: {{reference}}{{/if}}";
			const variables = renderer.extractRequiredVariables(template);

			expect(variables).toEqual(["text"]);
		});

		it("should not include the conditional variable itself", () => {
			const template = "{{text}}{{#if hasRef}}Yes{{/if}}";
			const variables = renderer.extractRequiredVariables(template);

			expect(variables).toEqual(["text"]);
		});

		it("should handle multiple conditionals", () => {
			const template =
				"{{required1}}{{#if opt1}}{{opt1}}{{/if}}{{required2}}{{#if opt2}}{{opt2}}{{/if}}";
			const variables = renderer.extractRequiredVariables(template);

			expect(variables).toEqual(["required1", "required2"]);
		});

		it("should return empty array for template with only optional variables", () => {
			const template = "{{#if text}}{{text}}{{/if}}";
			const variables = renderer.extractRequiredVariables(template);

			expect(variables).toEqual([]);
		});
	});
});
