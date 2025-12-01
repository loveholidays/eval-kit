import { readFile, writeFile } from "node:fs/promises";
import type { BatchState } from "./types.js";

export interface StateManagerConfig {
	readonly stateFilePath?: string;
	readonly autoSaveInterval?: number; // milliseconds
	readonly onStateSave?: (state: BatchState) => void | Promise<void>;
}

export class StateManager {
	private readonly stateFilePath?: string;
	private readonly autoSaveInterval?: number;
	private readonly onStateSave?: (state: BatchState) => void | Promise<void>;
	private autoSaveTimer?: NodeJS.Timeout;
	private currentState?: BatchState;

	constructor(config: StateManagerConfig) {
		this.stateFilePath = config.stateFilePath;
		this.autoSaveInterval = config.autoSaveInterval;
		this.onStateSave = config.onStateSave;
	}

	/**
	 * Initialize with a new batch state
	 */
	initialize(state: BatchState): void {
		this.currentState = state;
		if (this.autoSaveInterval) {
			this.startAutoSave();
		}
	}

	/**
	 * Update the current state
	 */
	update(updates: Partial<BatchState>): void {
		if (!this.currentState) {
			throw new Error("State not initialized. Call initialize() first.");
		}

		this.currentState = {
			...this.currentState,
			...updates,
			lastUpdateTime: new Date().toISOString(),
		};
	}

	/**
	 * Save current state to file and/or call callback
	 */
	async save(): Promise<void> {
		if (!this.currentState) {
			throw new Error("No state to save. Call initialize() first.");
		}

		// Save to file if path provided
		if (this.stateFilePath) {
			const json = JSON.stringify(this.currentState, null, 2);
			await writeFile(this.stateFilePath, json, { encoding: "utf-8" });
		}

		// Call callback if provided
		if (this.onStateSave) {
			const result = this.onStateSave(this.currentState);
			if (result instanceof Promise) {
				await result;
			}
		}
	}

	/**
	 * Load state from file
	 */
	async load(filePath?: string): Promise<BatchState> {
		const path = filePath ?? this.stateFilePath;
		if (!path) {
			throw new Error("No state file path provided");
		}

		try {
			const content = await readFile(path, { encoding: "utf-8" });
			const state = JSON.parse(content) as BatchState;
			this.currentState = state;
			return state;
		} catch (error) {
			throw new Error(
				`Failed to load state from ${path}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get current state
	 */
	getState(): BatchState | undefined {
		return this.currentState;
	}

	/**
	 * Start auto-save timer
	 */
	private startAutoSave(): void {
		if (this.autoSaveTimer) {
			clearInterval(this.autoSaveTimer);
		}

		this.autoSaveTimer = setInterval(() => {
			this.save().catch((error) => {
				console.error("Auto-save failed:", error);
			});
		}, this.autoSaveInterval);
	}

	/**
	 * Stop auto-save timer
	 */
	stopAutoSave(): void {
		if (this.autoSaveTimer) {
			clearInterval(this.autoSaveTimer);
			this.autoSaveTimer = undefined;
		}
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		this.stopAutoSave();
		// Final save before cleanup
		if (this.currentState) {
			await this.save();
		}
	}
}
