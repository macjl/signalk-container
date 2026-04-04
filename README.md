# signalk-container

Shared container runtime management (Podman/Docker) for Signal K plugins.

Instead of each plugin implementing its own container orchestration, they delegate to this plugin. It detects the available runtime, pulls images, manages container lifecycles, and provides a config panel in the Admin UI.

## Features

- **Runtime detection** -- Podman preferred, Docker fallback, podman-shim aware
- **Container lifecycle** -- pull, create, start, stop, remove with `sk-` prefix naming
- **One-shot jobs** -- run containers for batch tasks (export, conversion, etc.)
- **Image management** -- scheduled pruning of dangling images (weekly/monthly)
- **SELinux support** -- `:Z` volume flags for Podman on Fedora/RHEL
- **Config panel** -- runtime status, managed containers with stop/remove controls, prune button
- **Cross-plugin API** -- other plugins use `globalThis.__signalk_containerManager`

## How Other Plugins Use It

```typescript
const containers = (globalThis as any).__signalk_containerManager
if (!containers) {
  app.setPluginError('signalk-container plugin required')
  return
}

// Start a long-running service container
await containers.ensureRunning('my-service', {
  image: 'myorg/myimage',
  tag: 'latest',
  ports: { '8080/tcp': '127.0.0.1:8080' },
  volumes: { '/data': app.getDataDirPath() },
  env: { MY_VAR: 'value' },
  restart: 'unless-stopped'
})

// Run a one-shot job
const result = await containers.runJob({
  image: 'myorg/converter',
  command: ['convert', '--input', '/in/data.csv'],
  inputs: { '/in': '/host/path/input' },
  outputs: { '/out': '/host/path/output' },
  timeout: 120
})
```

## API

| Method | Description |
|--------|-------------|
| `getRuntime()` | Returns `{ runtime, version, isPodmanDockerShim }` or `null` |
| `pullImage(image, onProgress?)` | Pull a container image |
| `imageExists(image)` | Check if image exists locally |
| `ensureRunning(name, config, options?)` | Create and start container if not running |
| `stop(name)` | Stop a container |
| `remove(name)` | Stop and remove a container |
| `getState(name)` | Returns `running`, `stopped`, `missing`, or `no-runtime` |
| `runJob(config)` | Execute a one-shot container job |
| `prune()` | Remove dangling images |
| `listContainers()` | List all `sk-` prefixed containers |

## REST Endpoints

All mounted at `/plugins/signalk-container/api/`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/runtime` | Detected runtime info |
| GET | `/containers` | List managed containers |
| GET | `/containers/:name/state` | Container state |
| POST | `/containers/:name/stop` | Stop container |
| POST | `/containers/:name/remove` | Remove container |
| POST | `/prune` | Prune dangling images |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Preferred runtime | `auto` | Auto-detect, or force `podman`/`docker` |
| Auto-prune images | `weekly` | `off`, `weekly`, or `monthly` |
| Max concurrent jobs | `2` | Limit parallel one-shot job executions |

## Requirements

- Node.js >= 22
- Podman or Docker installed on the host
- Signal K server

## License

MIT
