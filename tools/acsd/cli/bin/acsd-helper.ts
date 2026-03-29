#!/usr/bin/env bun

import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
	Database,
	FileState,
	FileMetadata,
	getFileMetadata,
	getFirstGenerationChildren,
	getParentsToRoot,
	PROJECT_ROOT,
	getTemplateForFile,
} from "../../core/microcycle";

const STATE_DIR = resolve(PROJECT_ROOT, ".ascd");
const STATE_DB = resolve(STATE_DIR, "state.db");

const command = process.argv[2];
const filePath = process.argv[3];

if (!command) {
	console.error(
		JSON.stringify({ error: "Usage: bun acsd-helper <command> [args]" }),
	);
	process.exit(1);
}

function ensureDbInitialized() {
	if (!existsSync(STATE_DIR)) {
		mkdirSync(STATE_DIR, { recursive: true });
	}
	const db = new Database(STATE_DB);
	db.close();
}

try {
	switch (command) {
		case "init-db": {
			if (!existsSync(STATE_DIR)) {
				mkdirSync(STATE_DIR, { recursive: true });
			}
			const db = new Database(STATE_DB);
			db.close();
			console.log(JSON.stringify({ success: true, message: "Database initialized" }));
			break;
		}

		case "clean-db": {
			if (!existsSync(STATE_DB)) {
				console.log(JSON.stringify({ success: true, message: "Database does not exist" }));
				break;
			}
			const db = new Database(STATE_DB);
			db.clean();
			db.close();
			console.log(JSON.stringify({ success: true, message: "Database cleaned" }));
			break;
		}

		case "backup-db": {
			const backupPath = process.argv[3];
			if (!existsSync(STATE_DB)) {
				console.log(JSON.stringify({ error: "Database does not exist" }));
				process.exit(1);
			}
			const db = new Database(STATE_DB);
			db.backup(backupPath);
			db.close();
			console.log(JSON.stringify({ success: true, message: "Database backed up" }));
			break;
		}

		case "integrity-check": {
			if (!existsSync(STATE_DB)) {
				console.log(JSON.stringify({ success: true, integrity: "ok", message: "Database does not exist" }));
				break;
			}
			const db = new Database(STATE_DB);
			const integrity = db.integrityCheck();
			db.close();
			console.log(JSON.stringify({ success: true, integrity: integrity ? "ok" : "corrupted" }));
			break;
		}

		case "get-global-state": {
			ensureDbInitialized();
			const db = new Database(STATE_DB);
			const state = db.getGlobalState();
			db.close();
			console.log(JSON.stringify(state));
			break;
		}

		case "get-file-state": {
			if (!filePath) {
				throw new Error("get-file-state requires filePath as argument");
			}
			ensureDbInitialized();
			const db = new Database(STATE_DB);
			const fileState = db.getFileState(filePath);
			db.close();
			console.log(JSON.stringify({ exists: !!fileState, fileState }));
			break;
		}

		case "update-file-state": {
			if (!filePath) {
				throw new Error("update-file-state requires filePath as argument");
			}
			ensureDbInitialized();
			const db = new Database(STATE_DB);

			const fileStateJson = await new Promise<string>((resolve, reject) => {
				let data = "";
				process.stdin.setEncoding("utf-8");
				process.stdin.on("data", (chunk) => {
					data += chunk;
				});
				process.stdin.on("end", () => resolve(data));
				process.stdin.on("error", reject);
			});

			const fileState = JSON.parse(fileStateJson) as FileState;

			db.updateFileState(filePath, fileState);
			db.close();
			console.log(JSON.stringify({ success: true }));
			break;
		}

		case "delete-file-state": {
			if (!filePath) {
				throw new Error("delete-file-state requires filePath as argument");
			}
			ensureDbInitialized();
			const db = new Database(STATE_DB);
			db.deleteFileState(filePath);
			db.close();
			console.log(JSON.stringify({ success: true }));
			break;
		}

		case "remove-descendants": {
			if (!filePath) {
				throw new Error("remove-descendants requires filePath as argument");
			}
			ensureDbInitialized();
			const db = new Database(STATE_DB);
			db.removeAllDescendants(filePath);
			db.close();
			console.log(JSON.stringify({ success: true }));
			break;
		}

		case "can-skip": {
			if (!filePath) {
				throw new Error("can-skip requires filePath as argument");
			}
			ensureDbInitialized();
			const db = new Database(STATE_DB);
			const metadata = getFileMetadata(filePath, PROJECT_ROOT);
			const result = db.canSkip(filePath, metadata);
			db.close();
			console.log(JSON.stringify({ canSkip: result, mtime: metadata.mtime, checksum: metadata.checksum }));
			break;
		}

		case "get-parents": {
			if (!filePath) {
				throw new Error("get-parents requires filePath as argument");
			}
			const parents = getParentsToRoot(filePath, process.argv[4] || "acsd/vision.md");
			console.log(JSON.stringify({ parents }));
			break;
		}

		case "get-db-parents": {
			if (!filePath) {
				throw new Error("get-db-parents requires filePath as argument");
			}
			ensureDbInitialized();
			const db = new Database(STATE_DB);
			const parents = db.getParents(filePath);
			db.close();
			console.log(JSON.stringify({ parents }));
			break;
		}

		case "get-children": {
			if (!filePath) {
				throw new Error("get-children requires filePath as argument");
			}
			const children = getFirstGenerationChildren(filePath);
			console.log(JSON.stringify({ children }));
			break;
		}

		case "get-db-children": {
			if (!filePath) {
				throw new Error("get-db-children requires filePath as argument");
			}
			ensureDbInitialized();
			const db = new Database(STATE_DB);
			const children = db.getChildren(filePath);
			db.close();
			console.log(JSON.stringify({ children }));
			break;
		}

		case "get-template": {
			if (!filePath) {
				throw new Error("get-template requires filePath as argument");
			}
			const templateInfo = getTemplateForFile(filePath);
			console.log(JSON.stringify(templateInfo));
			break;
		}

		default: {
			console.error(JSON.stringify({ error: `Unknown command: ${command}` }));
			process.exit(1);
		}
	}
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(JSON.stringify({ error: message }));
	process.exit(1);
}
