# Contributing to eval-kit

We welcome contributions through pull requests and issues. If you're planning to work on a feature or bug fix, we encourage you to open an issue first so we can discuss the approach and provide guidance.

## Getting Started

### Development Setup

Install dependencies using pnpm:

```bash
pnpm install
```

### Development Commands

- `pnpm run build` - Build the package for distribution
- `pnpm run lint` - Run biome linter
- `pnpm run lint:fix` - Run biome linter and auto-fix issues
- `pnpm run format` - Format code with biome
- `pnpm run test` - Run the jest test suite
- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run test:coverage` - Run tests with coverage report
- `pnpm run typecheck` - Run TypeScript type checking

## Making Contributions

1. Fork the repository and create a new branch from `main`
2. Make your changes, ensuring code follows the existing style
3. Add or update tests as needed
4. Run `pnpm run lint` and `pnpm run test` to verify everything works
5. Use a title that is descriptive of the changes you are making
6. Submit a pull request with a clear description of your changes

## Release Process

This project uses [changesets](https://github.com/changesets/changesets) for version management.

When making a contribution that should trigger a new release:

1. Run `pnpm changeset` to create a new changeset
2. Follow the prompts to describe your changes and specify the version bump type
3. Commit the generated changeset file along with your changes

New versions will be published on merge to main if a changeset was supplied as part of a pull request.

For more details on how changesets work, see the [.changeset/README.md](.changeset/README.md) file.

## Questions?

Feel free to open an issue if you have any questions or need help getting started!
