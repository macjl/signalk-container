# signalk-container

Shared container runtime management (Podman/Docker) for Signal K plugins.

Instead of each plugin implementing its own container orchestration, they delegate to this plugin. It detects the available runtime, pulls images, manages container lifecycles, and provides a config panel in the Admin UI.

## Features

- **Runtime detection** -- Podman preferred, Docker fallback, podman-shim aware
- **Container lifecycle** -- pull, create, start, stop, remove with `sk-` prefix naming
- **One-shot jobs** -- run containers for batch tasks (export, conversion, etc.)
- **Image management** -- scheduled pruning of dangling images (weekly/monthly)
- **SELinux support** -- `:Z` volume flags for Podman on Fedora/RHEL
- **Podman image qualification** -- automatically prefixes `docker.io/` for short image names
- **Config panel** -- runtime status, managed containers with start/stop/remove controls, prune button
- **Cross-plugin API** -- other plugins use `globalThis.__signalk_containerManager`

## Config Panel

The plugin embeds a React config panel in the Signal K Admin UI (via Module Federation) showing:

- Detected runtime with version and status indicator
- List of managed containers with state (green=running, yellow=stopped)
- **Start** button for stopped containers
- **Stop** button for running containers
- **Remove** button with confirmation dialog when container is running
- Prune dangling images button
- Settings for preferred runtime and auto-prune schedule

## How Other Plugins Use It

```typescript
const containers = (globalThis as any).__signalk_containerManager;
if (!containers) {
  app.setPluginError("signalk-container plugin required");
  return;
}

// Start a long-running service container
await containers.ensureRunning("my-service", {
  image: "myorg/myimage",
  tag: "latest",
  ports: { "8080/tcp": "127.0.0.1:8080" },
  volumes: { "/data": app.getDataDirPath() },
  env: { MY_VAR: "value" },
  restart: "unless-stopped",
});

// Run a one-shot job
const result = await containers.runJob({
  image: "myorg/converter",
  command: ["convert", "--input", "/in/data.csv"],
  inputs: { "/in": "/host/path/input" },
  outputs: { "/out": "/host/path/output" },
  timeout: 120,
});
```

See [doc/plugin-developer-guide.md](doc/plugin-developer-guide.md) for the full integration guide with gotchas and patterns.

## API

| Method                                  | Description                                                  |
| --------------------------------------- | ------------------------------------------------------------ |
| `getRuntime()`                          | Returns `{ runtime, version, isPodmanDockerShim }` or `null` |
| `pullImage(image, onProgress?)`         | Pull a container image (auto-qualifies for Podman)           |
| `imageExists(image)`                    | Check if image exists locally                                |
| `ensureRunning(name, config, options?)` | Create and start container if not running                    |
| `start(name)`                           | Start a stopped container                                    |
| `stop(name)`                            | Stop a running container                                     |
| `remove(name)`                          | Stop and remove a container                                  |
| `getState(name)`                        | Returns `running`, `stopped`, `missing`, or `no-runtime`     |
| `runJob(config)`                        | Execute a one-shot container job                             |
| `prune()`                               | Remove dangling images                                       |
| `listContainers()`                      | List all `sk-` prefixed containers                           |
| `execInContainer(name, command)`        | Run a command inside a running container                     |
| `ensureNetwork(name)`                   | Create a Podman/Docker network if it doesn't exist           |
| `removeNetwork(name)`                   | Remove a network                                             |
| `connectToNetwork(container, network)`  | Add a container to a network (bridge mode only)              |
| `disconnectFromNetwork(container, net)` | Remove a container from a network                            |

## REST Endpoints

All mounted at `/plugins/signalk-container/api/`:

| Method | Path                       | Description                 |
| ------ | -------------------------- | --------------------------- |
| GET    | `/runtime`                 | Detected runtime info       |
| GET    | `/containers`              | List managed containers     |
| GET    | `/containers/:name/state`  | Container state             |
| POST   | `/containers/:name/start`  | Start a stopped container   |
| POST   | `/containers/:name/stop`   | Stop a running container    |
| POST   | `/containers/:name/remove` | Stop and remove a container |
| POST   | `/prune`                   | Prune dangling images       |

## Configuration

| Setting             | Default  | Description                             |
| ------------------- | -------- | --------------------------------------- |
| Preferred runtime   | `auto`   | Auto-detect, or force `podman`/`docker` |
| Auto-prune images   | `weekly` | `off`, `weekly`, or `monthly`           |
| Max concurrent jobs | `2`      | Limit parallel one-shot job executions  |

## Requirements

- Node.js >= 22
- Podman or Docker installed on the host
- Signal K server

## Running Signal K in a Container

If your Signal K server itself runs inside a container (Docker, Podman),
this plugin needs access to the host's container runtime to manage other
containers. The plugin auto-detects this scenario via `/.dockerenv` or
`/run/.containerenv` and prefixes the status with `(in-container)`.

For the plugin to work, you must expose the host's container runtime to
the Signal K container:

### Docker (with security caveats)

```yaml
services:
  signalk:
    image: signalk/signalk-server
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /usr/bin/docker:/usr/bin/docker:ro
```

The Signal K image must include the `docker` CLI binary, OR you mount
it from the host as shown above. Containers managed by the plugin
become **siblings** of the Signal K container, not nested.

> [!warning]
> Mounting `/var/run/docker.sock` gives the container **root-equivalent
> access to the host**. Anyone who compromises Signal K (including via
> a malicious plugin) can take over the entire host. Only use this if
> you understand and accept the security implications.

### Podman (rootless, safer)

```yaml
services:
  signalk:
    image: signalk/signalk-server
    volumes:
      - $XDG_RUNTIME_DIR/podman/podman.sock:/var/run/podman.sock
      - /usr/bin/podman:/usr/bin/podman:ro
    environment:
      - DOCKER_HOST=unix:///var/run/podman.sock
```

Rootless Podman runs as your user, not root, so the security exposure
is limited to your user account rather than the entire host.

### Networking caveats

When Signal K runs in a container, containers spawned by this plugin
are **siblings** on the host's container network, not inside Signal K's
network namespace. This affects:

- The shared `sk-network` works only if Signal K is also attached to it
  (add it externally or via the same compose file)
- `host.containers.internal` from spawned containers points to the host
  itself, not the Signal K container — use Signal K's container name
  for direct communication

### Recommended setup

For the simplest experience with managed containers, run **Signal K
natively on the host** rather than in a container. The plugin and its
ecosystem (signalk-questdb, signalk-grafana) are designed for this case.

## License

MIT
