import { execFile } from "child_process";
import { ContainerRuntimeInfo, RuntimeName, RuntimePreference } from "./types";

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("LISTEN_")) {
      delete env[key];
    }
  }
  return env;
}

function exec(
  cmd: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { env: env ?? cleanEnv(), timeout: 10000 },
      (error, stdout, stderr) => {
        resolve({
          stdout: (stdout ?? "").toString().trim(),
          stderr: (stderr ?? "").toString().trim(),
          exitCode: error ? ((error as any).code ?? 1) : 0,
        });
      },
    );
  });
}

async function tryRuntime(
  name: RuntimeName,
  env: NodeJS.ProcessEnv,
): Promise<ContainerRuntimeInfo | null> {
  const result = await exec(name, ["--version"], env);
  if (result.exitCode !== 0) return null;

  const version =
    result.stdout.replace(/^.*version\s*/i, "").split(/[\s,]/)[0] || "unknown";
  let isPodmanDockerShim = false;

  if (name === "docker") {
    isPodmanDockerShim = result.stdout.toLowerCase().includes("podman");
  }

  return {
    runtime: isPodmanDockerShim ? "podman" : name,
    version,
    isPodmanDockerShim,
  };
}

export async function detectRuntime(
  preference: RuntimePreference,
): Promise<ContainerRuntimeInfo | null> {
  const env = cleanEnv();

  if (preference !== "auto") {
    return tryRuntime(preference, env);
  }

  const podman = await tryRuntime("podman", env);
  if (podman) return podman;

  const docker = await tryRuntime("docker", env);
  if (docker) return docker;

  return null;
}

export function runtimeCmd(info: ContainerRuntimeInfo): string {
  return info.isPodmanDockerShim ? "docker" : info.runtime;
}

export async function execRuntime(
  info: ContainerRuntimeInfo,
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return exec(runtimeCmd(info), args, cleanEnv());
}

export async function execRuntimeLong(
  info: ContainerRuntimeInfo,
  args: string[],
  onProgress?: (msg: string) => void,
  timeout?: number,
): Promise<{ exitCode: number; log: string[] }> {
  const cmd = runtimeCmd(info);
  const env = cleanEnv();
  const log: string[] = [];
  const maxLogLines = 200;

  return new Promise((resolve, reject) => {
    const proc = execFile(cmd, args, {
      env,
      timeout: timeout ?? 600000,
      maxBuffer: 10 * 1024 * 1024,
    });

    proc.stdout?.on("data", (data: Buffer | string) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        if (log.length >= maxLogLines) log.shift();
        log.push(line);
        try {
          onProgress?.(line);
        } catch {
          /* plugin callback errors must not crash us */
        }
      }
    });

    proc.stderr?.on("data", (data: Buffer | string) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        if (log.length >= maxLogLines) log.shift();
        log.push(line);
        try {
          onProgress?.(line);
        } catch {
          /* plugin callback errors must not crash us */
        }
      }
    });

    proc.on("close", (code) => {
      resolve({ exitCode: code ?? 1, log });
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}
