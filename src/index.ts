import { IRouter } from "express";
import path from "path";
import {
  ContainerConfig,
  ContainerInfo,
  ContainerJobConfig,
  ContainerJobResult,
  ContainerManagerApi,
  ContainerRuntimeInfo,
  ContainerState,
  HealthCheckOptions,
  PluginConfig,
  PruneResult,
} from "./types";
import { detectRuntime, isContainerized } from "./runtime";
import {
  connectToNetwork,
  disconnectFromNetwork,
  ensureNetwork,
  ensureRunning,
  execInContainer,
  getContainerState,
  getImageDigest,
  imageExists,
  listContainers,
  pruneImages,
  pullImage,
  qualifyImage as qualifyImageForRuntime,
  removeContainer,
  removeNetwork,
  startContainer,
  stopContainer,
} from "./containers";
import { runJob } from "./jobs";
import { UpdateService } from "./updates/service";
import { FileUpdateCache } from "./updates/cache";
import { registerUpdateRoutes } from "./updates/routes";

interface App {
  debug: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  setPluginStatus: (msg: string) => void;
  setPluginError: (msg: string) => void;
  getDataDirPath?: () => string;
  handleMessage?: (pluginId: string, delta: unknown) => void;
  [key: string]: unknown;
}

module.exports = (app: App) => {
  let runtimeInfo: ContainerRuntimeInfo | null = null;
  let pruneTimer: NodeJS.Timeout | null = null;
  const healthTimers = new Map<string, NodeJS.Timeout>();
  let updateService: UpdateService | null = null;

  const api: ContainerManagerApi = {
    getRuntime() {
      return runtimeInfo;
    },

    async pullImage(image: string, onProgress?: (msg: string) => void) {
      if (!runtimeInfo) throw new Error("No container runtime available");
      await pullImage(
        runtimeInfo,
        qualifyImageForRuntime(image, runtimeInfo),
        onProgress,
      );
    },

    async imageExists(image: string) {
      if (!runtimeInfo) return false;
      return imageExists(
        runtimeInfo,
        qualifyImageForRuntime(image, runtimeInfo),
      );
    },

    async getImageDigest(imageOrContainer: string) {
      if (!runtimeInfo) return null;
      return getImageDigest(runtimeInfo, imageOrContainer);
    },

    async ensureRunning(
      name: string,
      config: ContainerConfig,
      options?: HealthCheckOptions,
    ) {
      if (!runtimeInfo) throw new Error("No container runtime available");
      await ensureRunning(
        runtimeInfo,
        name,
        config,
        (msg) => app.debug(msg),
        options,
      );

      if (options?.healthCheck) {
        const existing = healthTimers.get(name);
        if (existing) clearInterval(existing);

        const timer = setInterval(async () => {
          try {
            const ok = await options.healthCheck!();
            if (!ok) {
              options.onUnhealthy?.(name, "Health check returned false");
            }
          } catch (err) {
            options.onUnhealthy?.(
              name,
              err instanceof Error ? err.message : String(err),
            );
          }
        }, 60000);
        healthTimers.set(name, timer);
      }
    },

    async start(name: string) {
      if (!runtimeInfo) throw new Error("No container runtime available");
      await startContainer(runtimeInfo, name);
    },

    async stop(name: string) {
      if (!runtimeInfo) throw new Error("No container runtime available");
      await stopContainer(runtimeInfo, name);
    },

    async remove(name: string) {
      if (!runtimeInfo) throw new Error("No container runtime available");
      await removeContainer(runtimeInfo, name);
    },

    async getState(name: string): Promise<ContainerState> {
      if (!runtimeInfo) return "no-runtime";
      return getContainerState(runtimeInfo, name);
    },

    async runJob(config: ContainerJobConfig): Promise<ContainerJobResult> {
      if (!runtimeInfo) throw new Error("No container runtime available");
      return runJob(runtimeInfo, config);
    },

    async prune(): Promise<PruneResult> {
      if (!runtimeInfo) throw new Error("No container runtime available");
      return pruneImages(runtimeInfo);
    },

    async listContainers(): Promise<ContainerInfo[]> {
      if (!runtimeInfo) return [];
      return listContainers(runtimeInfo);
    },

    async execInContainer(name: string, command: string[]) {
      if (!runtimeInfo) throw new Error("No container runtime available");
      return execInContainer(runtimeInfo, name, command);
    },

    async ensureNetwork(name: string) {
      if (!runtimeInfo) throw new Error("No container runtime available");
      await ensureNetwork(runtimeInfo, name);
    },

    async removeNetwork(name: string) {
      if (!runtimeInfo) throw new Error("No container runtime available");
      await removeNetwork(runtimeInfo, name);
    },

    async connectToNetwork(containerName: string, networkName: string) {
      if (!runtimeInfo) throw new Error("No container runtime available");
      await connectToNetwork(runtimeInfo, containerName, networkName);
    },

    async disconnectFromNetwork(containerName: string, networkName: string) {
      if (!runtimeInfo) throw new Error("No container runtime available");
      await disconnectFromNetwork(runtimeInfo, containerName, networkName);
    },

    // `updates` is wired up in start() once the data dir is known.
    // Until then, register() is a silent no-op via the stub below.
    get updates() {
      return updateService ?? stubUpdateService;
    },
  };

  /**
   * Stub update service used between module load and start(). Calls
   * are silent no-ops so consumer plugins can register unconditionally.
   * Replaced by a real UpdateService instance in start().
   */
  const stubUpdateService = {
    register: () => {},
    unregister: () => {},
    checkOne: async () => {
      throw new Error("Container manager not yet started");
    },
    checkAll: async () => [],
    getLastResult: () => null,
    listRegistrations: () => [],
    sources: {
      githubReleases: () => ({
        async fetch() {
          return {
            kind: "error" as const,
            error: "Container manager not yet started",
          };
        },
      }),
      dockerHubTags: () => ({
        async fetch() {
          return {
            kind: "error" as const,
            error: "Container manager not yet started",
          };
        },
      }),
    },
  } as unknown as UpdateService;

  const plugin = {
    id: "signalk-container",
    name: "Container Manager",

    schema: {
      type: "object" as const,
      properties: {
        runtime: {
          type: "string",
          enum: ["auto", "podman", "docker"],
          default: "auto",
          title: "Container runtime",
          description:
            "Auto-detect (Podman preferred), or force a specific runtime",
        },
        pruneSchedule: {
          type: "string",
          enum: ["off", "weekly", "monthly"],
          default: "weekly",
          title: "Auto-prune dangling images",
        },
        maxConcurrentJobs: {
          type: "number",
          default: 2,
          title: "Max concurrent one-shot jobs",
          description: "Limit parallel container job executions",
        },
        updateCheckInterval: {
          type: "string",
          default: "24h",
          title: "Update check interval",
          description:
            "How often to check for container image updates (e.g. 24h, 12h, 1h). Min 1h.",
        },
        backgroundUpdateChecks: {
          type: "boolean",
          default: true,
          title: "Background update checks",
          description:
            "Periodically check for container image updates in the background. Disable on metered connections — manual checks via the UI button still work.",
        },
      },
    },

    start(config: PluginConfig) {
      // Instantiate the update service synchronously so consumer
      // plugins can call containers.updates.register(...) before
      // the runtime is detected. The service tolerates a null
      // runtime — it queues registrations and runs them on the
      // first scheduled tick after detectRuntime() succeeds.
      const dataDir = app.getDataDirPath
        ? app.getDataDirPath()
        : "/tmp/signalk-container";
      const cachePath = path.join(dataDir, "updates-cache.json");
      const intervalMs = parseDurationOrDefault(
        config.updateCheckInterval,
        24 * 60 * 60 * 1000,
      );
      updateService = new UpdateService({
        app: {
          debug: (msg, ...args) => app.debug(msg, ...args),
          error: (msg, ...args) => app.error(msg, ...args),
          handleMessage: app.handleMessage
            ? (id, delta) => app.handleMessage!(id, delta)
            : undefined,
        },
        containers: {
          getRuntime: () => runtimeInfo,
          getState: (name) =>
            runtimeInfo
              ? getContainerState(runtimeInfo, name)
              : Promise.resolve("no-runtime" as ContainerState),
          pullImage: async (image) => {
            if (!runtimeInfo) throw new Error("No container runtime available");
            await pullImage(
              runtimeInfo,
              qualifyImageForRuntime(image, runtimeInfo),
            );
          },
          getImageDigest: async (imageOrContainer) => {
            if (!runtimeInfo) return null;
            return getImageDigest(runtimeInfo, imageOrContainer);
          },
        },
        clock: {
          now: () => Date.now(),
          setTimer: (fn, delayMs) => setTimeout(fn, delayMs),
          clearTimer: (handle) => clearTimeout(handle as NodeJS.Timeout),
        },
        cache: new FileUpdateCache(cachePath, (msg) => app.debug(msg)),
        defaultCheckIntervalMs: intervalMs,
        backgroundChecks: config.backgroundUpdateChecks !== false,
      });

      // Expose API on global so other plugins can find it.
      // Each plugin gets a shallow copy of app (_.assign({}, app)),
      // so setting on app doesn't propagate. Global is the shared bus.
      (globalThis as any).__signalk_containerManager = api;

      // Async init — server does not await start()
      (async () => {
        const preference = config.runtime ?? "auto";
        const containerized = isContainerized();
        if (containerized) {
          app.debug(
            "Signal K is running inside a container. Container runtime " +
              "must be exposed (docker.sock + binary) for this plugin to work.",
          );
        }
        app.debug("detecting runtime, preference=%s", preference);
        runtimeInfo = await detectRuntime(preference);
        app.debug("detectRuntime result: %o", runtimeInfo);

        if (!runtimeInfo) {
          const msg = containerized
            ? "No container runtime found. Signal K appears to run inside a container — " +
              "you must mount the host's docker socket and binary. See README."
            : "No container runtime found. Install Podman: sudo apt install podman";
          app.setPluginError(msg);
          return;
        }

        const statusPrefix = containerized ? "(in-container) " : "";
        app.setPluginStatus(
          `${statusPrefix}${runtimeInfo.runtime} ${runtimeInfo.version}${runtimeInfo.isPodmanDockerShim ? " (podman shim)" : ""}`,
        );

        if (config.pruneSchedule && config.pruneSchedule !== "off") {
          const intervalMs =
            config.pruneSchedule === "weekly"
              ? 7 * 24 * 60 * 60 * 1000
              : 30 * 24 * 60 * 60 * 1000;
          pruneTimer = setInterval(async () => {
            try {
              const result = await pruneImages(runtimeInfo!);
              app.debug(
                `Pruned ${result.imagesRemoved} images, reclaimed ${result.spaceReclaimed}`,
              );
            } catch (err) {
              app.error("Auto-prune failed:", err);
            }
          }, intervalMs);
        }

        app.debug("Container manager started");
      })().catch((err) => {
        app.setPluginError(
          `Startup failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    },

    stop() {
      if (pruneTimer) {
        clearInterval(pruneTimer);
        pruneTimer = null;
      }
      for (const timer of healthTimers.values()) {
        clearInterval(timer);
      }
      healthTimers.clear();
      if (updateService) {
        updateService.stop();
        updateService = null;
      }
      delete (globalThis as any).__signalk_containerManager;
    },

    registerWithRouter(router: IRouter) {
      router.get("/api/runtime", (_req, res) => {
        if (!runtimeInfo) {
          res.status(503).json({ error: "No container runtime available" });
          return;
        }
        res.json(runtimeInfo);
      });

      router.get("/api/containers", async (_req, res) => {
        try {
          const containers = await api.listContainers();
          res.json(containers);
        } catch (err) {
          res.status(500).json({
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      });

      router.get("/api/containers/:name/state", async (req, res) => {
        try {
          const state = await api.getState(req.params.name);
          res.json({ name: req.params.name, state });
        } catch (err) {
          res.status(500).json({
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      });

      router.post("/api/containers/:name/stop", async (req, res) => {
        try {
          await api.stop(req.params.name);
          res.json({ status: "stopped" });
        } catch (err) {
          res.status(500).json({
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      });

      router.post("/api/containers/:name/start", async (req, res) => {
        try {
          await api.start(req.params.name);
          res.json({ status: "started" });
        } catch (err) {
          res.status(500).json({
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      });

      router.post("/api/containers/:name/remove", async (req, res) => {
        try {
          await api.remove(req.params.name);
          res.json({ status: "removed" });
        } catch (err) {
          res.status(500).json({
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      });

      router.post("/api/prune", async (_req, res) => {
        try {
          const result = await api.prune();
          res.json(result);
        } catch (err) {
          res.status(500).json({
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      });

      // Update detection routes (registered if and only if the
      // service was instantiated in start()).
      if (updateService) {
        registerUpdateRoutes(router, updateService, () => runtimeInfo !== null);
      }
    },
  };

  return plugin;
};

function parseDurationOrDefault(
  input: string | undefined,
  fallback: number,
): number {
  if (!input) return fallback;
  const m = input.trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = (m[2] ?? "ms").toLowerCase();
  switch (unit) {
    case "ms":
      return n;
    case "s":
      return n * 1000;
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "d":
      return n * 24 * 60 * 60 * 1000;
    default:
      return fallback;
  }
}
