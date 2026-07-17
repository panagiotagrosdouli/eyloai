# EYLO AI

EYLO AI is an open engineering and research platform for building transparent, reproducible AI products. The repository currently contains interface prototypes and this dependency-light official platform layer.

## Verified scope

- Responsive company and developer website
- Product and research documentation based on repository evidence
- Dark/light themes and keyboard-accessible navigation
- Docker image with health check
- Standard-library validation tests and GitHub Actions CI

The repository does **not** currently verify production AI services, trained models, datasets, published papers, benchmarks, customer deployments, or external certifications.

## Run locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Validate

```bash
python3 -m unittest discover -s tests -v
```

## Container

```bash
docker compose up --build
```

See [Developer Guide](docs/DEVELOPER_GUIDE.md), [Repository Audit](docs/REPOSITORY_AUDIT.md), and [Roadmap](docs/ROADMAP.md).
